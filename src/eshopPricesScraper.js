// Direct scraper for eshop-prices.com to match their exact data
const axios = require('axios');
const cheerio = require('cheerio');
const { convertToSGD } = require('./currencyConverter');

// Cache for eshop-prices.com data (15 minutes as requested)
const eshopPricesCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Rate limiting for scraping
const RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
let lastRequestTime = 0;

async function searchGameOnEshopPrices(gameName) {
  console.log(`[ESHOP-PRICES] Searching for: ${gameName}`);
  
  const cacheKey = `search_${gameName.toLowerCase().trim()}`;
  const cached = eshopPricesCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[ESHOP-PRICES] Using cached data for "${gameName}"`);
    return cached.data;
  }
  
  try {
    // Rate limiting
    await enforceRateLimit();
    
    // Step 1: Search for the game by crawling pages
    const gameUrl = await findGameUrl(gameName);
    
    if (!gameUrl) {
      const result = {
        type: 'no_results',
        message: `No games found on eshop-prices.com for "${gameName}"`
      };
      
      // Cache negative results for shorter time
      eshopPricesCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    }
    
    // Step 2: Scrape pricing data from the game page
    console.log(`[ESHOP-PRICES] Found game page: ${gameUrl}`);
    const gameData = await scrapeGamePricing(gameUrl, gameName);
    
    // Cache the result
    eshopPricesCache.set(cacheKey, {
      data: gameData,
      timestamp: Date.now()
    });
    
    return gameData;
    
  } catch (error) {
    console.error(`[ESHOP-PRICES] Error searching for "${gameName}":`, error.message);
    
    return {
      type: 'error',
      message: 'Sorry, there was an error fetching data from eshop-prices.com. Please try again later.'
    };
  }
}

async function findGameUrl(gameName) {
  console.log(`[ESHOP-PRICES] Searching through game pages for: ${gameName}`);
  
  const normalizedSearch = gameName.toLowerCase().trim();
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 1);
  
  // Try different search strategies
  const searchUrls = [
    `https://eshop-prices.com/games/popular?page=1`,
    `https://eshop-prices.com/games/on-sale?page=1`, 
    `https://eshop-prices.com/games?page=1`,
    `https://eshop-prices.com/games?page=2`,
    `https://eshop-prices.com/games?page=3`
  ];
  
  for (let i = 0; i < searchUrls.length; i++) {
    const searchUrl = searchUrls[i];
    try {
      await enforceRateLimit();
      
      console.log(`[ESHOP-PRICES] Checking ${searchUrl}...`);
      
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Look for games in the page
      const games = [];
      
      // Extract game links and titles
      $('a[href*="/games/"]').each((i, element) => {
        const $el = $(element);
        const href = $el.attr('href');
        const title = $el.text().trim() || $el.find('img').attr('alt') || '';
        
        if (href && title && href.includes('/games/') && !href.includes('/games?')) {
          games.push({
            url: href.startsWith('http') ? href : `https://eshop-prices.com${href}`,
            title: title
          });
        }
      });
      
      // Also check any game titles in text or data attributes
      $('.game-title, .title, [data-game-title]').each((i, element) => {
        const $el = $(element);
        const title = $el.text().trim() || $el.attr('data-game-title') || '';
        const link = $el.closest('a').attr('href') || $el.find('a').attr('href');
        
        if (title && link && link.includes('/games/')) {
          games.push({
            url: link.startsWith('http') ? link : `https://eshop-prices.com${link}`,
            title: title
          });
        }
      });
      
      console.log(`[ESHOP-PRICES] Found ${games.length} games on this page`);
      
      // Score and find the best match
      for (const game of games) {
        const score = calculateMatchScore(normalizedSearch, game.title.toLowerCase());
        
        if (score > 100) { // Good match threshold
          console.log(`[ESHOP-PRICES] Found potential match: "${game.title}" (score: ${score})`);
          
          // If it's a very good match, return immediately
          if (score > 500) {
            console.log(`[ESHOP-PRICES] Excellent match found: ${game.title}`);
            return game.url;
          }
        }
      }
      
      // If we found any decent matches on this page, take the best one
      const goodMatches = games
        .map(game => ({
          ...game,
          score: calculateMatchScore(normalizedSearch, game.title.toLowerCase())
        }))
        .filter(game => game.score > 100)
        .sort((a, b) => b.score - a.score);
      
      if (goodMatches.length > 0) {
        console.log(`[ESHOP-PRICES] Best match on this page: "${goodMatches[0].title}" (score: ${goodMatches[0].score})`);
        return goodMatches[0].url;
      }
      
    } catch (error) {
      console.error(`[ESHOP-PRICES] Error searching ${searchUrl}:`, error.message);
      continue;
    }
  }
  
  return null;
}

async function scrapeGamePricing(gameUrl, originalGameName) {
  console.log(`[ESHOP-PRICES] Scraping pricing data from: ${gameUrl}`);
  
  await enforceRateLimit();
  
  try {
    const response = await axios.get(gameUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract game title
    const gameTitle = $('h1').first().text().trim() || 
                     $('title').text().replace(' - eshop-prices.com', '').trim() || 
                     originalGameName;
    
    console.log(`[ESHOP-PRICES] Extracting prices for: ${gameTitle}`);
    
    // Extract pricing data - eshop-prices.com uses simple text structure
    const prices = [];
    
    // Get all text content and various elements that might contain pricing
    const allText = $.text();
    const paragraphs = $('p').toArray();
    const divs = $('div').toArray();
    const spans = $('span').toArray();
    const allElements = [...paragraphs, ...divs, ...spans];
    
    // Look for country names and price patterns
    const countryPatterns = [
      'Argentina', 'Australia', 'Austria', 'Belgium', 'Brazil', 'Bulgaria', 'Canada', 
      'Chile', 'Colombia', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia',
      'Finland', 'France', 'Germany', 'Greece', 'Hong Kong', 'Hungary', 'Ireland', 
      'Italy', 'Japan', 'Latvia', 'Lithuania', 'Luxembourg', 'Malaysia', 'Malta', 
      'Mexico', 'Netherlands', 'New Zealand', 'Norway', 'Peru', 'Poland', 'Portugal', 
      'Romania', 'Russia', 'Singapore', 'Slovakia', 'Slovenia', 'South Africa', 
      'South Korea', 'Spain', 'Sweden', 'Switzerland', 'Taiwan', 'Thailand', 
      'Turkey', 'Ukraine', 'United Kingdom', 'United States', 'UK', 'USA'
    ];
    
    // Currency pattern to match prices
    const currencyPattern = /[\$€£¥₩₹₨₦₡₪₫₱₲₴₸₼₽￥￦R﷼][0-9.,\s]+|[0-9.,]+\s*(USD|EUR|GBP|JPY|KRW|CAD|AUD|CHF|SEK|NOK|DKK|PLN|CZK|HUF|RUB|BRL|MXN|ZAR|HKD|SGD|TWD|THB|MYR|INR|TRY|UAH)/gi;
    
    // Collect potential pricing data first
    const potentialPrices = [];
    
    // Process each element to find country-price pairs
    for (let index = 0; index < allElements.length; index++) {
      const element = allElements[index];
      const text = $(element).text().trim();
      
      // Check if this paragraph contains a country name
      const foundCountry = countryPatterns.find(country => 
        text.toLowerCase().includes(country.toLowerCase()) || 
        text === country
      );
      
      if (foundCountry) {
        console.log(`[ESHOP-PRICES] Found country: ${foundCountry} in paragraph: "${text}"`);
        
        // Look for price in the same paragraph or nearby paragraphs
        let priceText = '';
        let currency = '';
        let originalPrice = 0;
        let salePrice = 0;
        
        // Check current element and next few elements for price
        for (let i = 0; i < 5 && index + i < allElements.length; i++) {
          const checkText = $(allElements[index + i]).text().trim();
          const priceMatches = checkText.match(currencyPattern);
          
          if (priceMatches && priceMatches.length > 0) {
            priceText = checkText;
            
            // Extract prices - handle both single price and sale price formats
            const extractedPrices = priceMatches.map(match => {
              const numericValue = parseFloat(match.replace(/[^\d.,]/g, '').replace(',', '.'));
              return {
                value: numericValue,
                text: match
              };
            }).filter(p => !isNaN(p.value) && p.value > 0);
            
            if (extractedPrices.length > 0) {
              // If multiple prices, assume first is original, last is sale price
              originalPrice = extractedPrices[extractedPrices.length > 1 ? 0 : 0].value;
              salePrice = extractedPrices[extractedPrices.length > 1 ? extractedPrices.length - 1 : 0].value;
              currency = extractCurrencyFromPrice(priceMatches[0]);
              break;
            }
          }
        }
        
        // Use the lower price (sale price if available)
        const finalPrice = salePrice > 0 && salePrice < originalPrice ? salePrice : originalPrice;
        
        if (finalPrice > 0 && currency) {
          console.log(`[ESHOP-PRICES] Found price for ${foundCountry}: ${finalPrice} ${currency}`);
          
          potentialPrices.push({
            region: foundCountry,
            regionCode: getRegionCode(foundCountry),
            originalPrice: finalPrice,
            currency: currency,
            discount: originalPrice > salePrice && salePrice > 0 ? 
              Math.round(((originalPrice - salePrice) / originalPrice) * 100) : 0,
            difficult: isRegionDifficult(foundCountry),
            giftCards: hasGiftCards(foundCountry)
          });
        }
      }
    }
    
    // Fallback: Try to parse the entire text content for country-price patterns
    if (potentialPrices.length === 0) {
      console.log(`[ESHOP-PRICES] No prices found with element parsing, trying text analysis fallback...`);
      
      // Split the entire page text into lines and analyze each line
      const textLines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        
        // Check if line contains a country
        const foundCountry = countryPatterns.find(country => 
          line.toLowerCase().includes(country.toLowerCase())
        );
        
        if (foundCountry) {
          console.log(`[ESHOP-PRICES] Found country in text: ${foundCountry} in line: "${line}"`);
          
          // Look for prices in this line and nearby lines
          for (let j = Math.max(0, i - 2); j <= Math.min(textLines.length - 1, i + 2); j++) {
            const checkLine = textLines[j];
            const priceMatches = checkLine.match(currencyPattern);
            
            if (priceMatches && priceMatches.length > 0) {
              const prices = priceMatches.map(match => 
                parseFloat(match.replace(/[^\d.,]/g, '').replace(',', '.'))
              ).filter(p => !isNaN(p) && p > 0);
              
              if (prices.length > 0) {
                const price = prices[prices.length - 1]; // Use last (likely sale) price
                const currency = extractCurrencyFromPrice(priceMatches[0]);
                
                console.log(`[ESHOP-PRICES] Found price via text analysis: ${foundCountry}: ${price} ${currency}`);
                
                potentialPrices.push({
                  region: foundCountry,
                  regionCode: getRegionCode(foundCountry),
                  originalPrice: price,
                  currency: currency,
                  discount: 0,
                  difficult: isRegionDifficult(foundCountry),
                  giftCards: hasGiftCards(foundCountry)
                });
                break;
              }
            }
          }
        }
      }
    }
    
    // Convert currencies and build final price list
    for (const priceData of potentialPrices) {
      try {
        const sgdPrice = await convertToSGD(priceData.originalPrice, priceData.currency);
        
        if (sgdPrice > 0) {
          prices.push({
            ...priceData,
            sgdPrice: sgdPrice,
            title: gameTitle,
            source: 'eshop-prices.com'
          });
        }
      } catch (err) {
        console.error(`[ESHOP-PRICES] Error converting currency for ${priceData.region}:`, err.message);
      }
    }
    
    // Also try to extract JSON-LD structured data if available
    const jsonOffers = [];
    $('script[type="application/ld+json"]').each((i, element) => {
      try {
        const jsonData = JSON.parse($(element).html());
        
        if (jsonData.offers) {
          // Handle both single offer and array of offers
          const offers = Array.isArray(jsonData.offers) ? jsonData.offers : [jsonData.offers];
          
          offers.forEach(offer => {
            if (offer.price && offer.priceCurrency) {
              const price = parseFloat(offer.price);
              const currency = offer.priceCurrency;
              const region = offer.eligibleRegion || 'Japan'; // Default for eshop-prices.com
              
              if (!isNaN(price) && price > 0) {
                jsonOffers.push({
                  region: region,
                  regionCode: getRegionCode(region),
                  originalPrice: price,
                  currency: currency,
                  discount: 0,
                  difficult: isRegionDifficult(region),
                  giftCards: hasGiftCards(region)
                });
              }
            }
          });
        }
      } catch (err) {
        console.log(`[ESHOP-PRICES] Error parsing JSON-LD: ${err.message}`);
      }
    });
    
    // Process JSON-LD offers
    for (const offer of jsonOffers) {
      try {
        const sgdPrice = await convertToSGD(offer.originalPrice, offer.currency);
        
        if (sgdPrice > 0) {
          prices.push({
            ...offer,
            sgdPrice: sgdPrice,
            title: gameTitle,
            source: 'eshop-prices.com'
          });
        }
      } catch (err) {
        console.error(`[ESHOP-PRICES] Error converting JSON-LD currency:`, err.message);
      }
    }
    
    console.log(`[ESHOP-PRICES] Extracted ${prices.length} prices for "${gameTitle}"`);
    
    if (prices.length === 0) {
      return {
        type: 'no_prices',
        game: { title: gameTitle },
        message: `Found "${gameTitle}" on eshop-prices.com but no pricing data is available.`
      };
    }
    
    // Remove duplicates and sort by price
    const uniquePrices = [];
    const seenRegions = new Set();
    
    // Sort by SGD price first, then filter duplicates keeping the cheapest
    prices.sort((a, b) => a.sgdPrice - b.sgdPrice);
    
    for (const price of prices) {
      const key = `${price.regionCode}_${price.currency}`;
      if (!seenRegions.has(key)) {
        seenRegions.add(key);
        uniquePrices.push(price);
      }
    }
    
    return {
      type: 'prices',
      game: { title: gameTitle },
      prices: uniquePrices,
      totalRegionsChecked: uniquePrices.length
    };
    
  } catch (error) {
    console.error(`[ESHOP-PRICES] Error scraping ${gameUrl}:`, error.message);
    
    return {
      type: 'error',
      message: 'Error extracting pricing data from eshop-prices.com'
    };
  }
}

function calculateMatchScore(searchTerm, gameTitle) {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const title = gameTitle.toLowerCase();
  let score = 0;
  
  // Exact match gets highest score
  if (title === normalizedSearch) {
    return 2000;
  }
  
  // Title starts with search term
  if (title.startsWith(normalizedSearch)) {
    score += 1500;
  }
  
  // Title contains search term exactly
  if (title.includes(normalizedSearch)) {
    score += 1000;
  }
  
  // Word-by-word matching
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 1);
  const titleWords = title.split(' ').filter(w => w.length > 1);
  
  let exactWordMatches = 0;
  
  searchWords.forEach(searchWord => {
    titleWords.forEach(titleWord => {
      if (searchWord === titleWord) {
        exactWordMatches++;
        score += 200;
      } else if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        score += 100;
      }
    });
  });
  
  // Bonus for matching all search words
  if (exactWordMatches >= searchWords.length && searchWords.length > 1) {
    score += 800;
  }
  
  return score;
}

function extractCurrencyFromPrice(priceText) {
  const currencyMap = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₩': 'KRW',
    '₹': 'INR',
    '₨': 'INR',
    '₦': 'NGN',
    '₡': 'CRC',
    '₪': 'ILS',
    '₫': 'VND',
    '₱': 'PHP',
    '₲': 'PYG',
    '₴': 'UAH',
    '₸': 'KZT',
    '₼': 'AZN',
    '₽': 'RUB',
    'R$': 'BRL',
    'R': 'ZAR',
    'CHF': 'CHF',
    'kr': 'NOK',
    'kr.': 'DKK',
    'Kč': 'CZK',
    'zł': 'PLN',
    'Ft': 'HUF',
    'Lei': 'RON',
    'RM': 'MYR',
    'S/': 'PEN',
    '฿': 'THB',
    '₺': 'TRY'
  };
  
  // Check for multi-character symbols first
  for (const [symbol, currency] of Object.entries(currencyMap)) {
    if (symbol.length > 1 && priceText.includes(symbol)) {
      return currency;
    }
  }
  
  // Then check single character symbols
  for (const [symbol, currency] of Object.entries(currencyMap)) {
    if (symbol.length === 1 && priceText.includes(symbol)) {
      return currency;
    }
  }
  
  return 'USD'; // Default fallback
}

function getRegionCode(regionName) {
  const regionMap = {
    'United States': 'US',
    'USA': 'US',
    'Canada': 'CA',
    'Mexico': 'MX',
    'Brazil': 'BR',
    'Argentina': 'AR',
    'Chile': 'CL',
    'Colombia': 'CO',
    'Peru': 'PE',
    'United Kingdom': 'GB',
    'UK': 'GB',
    'Germany': 'DE',
    'France': 'FR',
    'Spain': 'ES',
    'Italy': 'IT',
    'Netherlands': 'NL',
    'Belgium': 'BE',
    'Switzerland': 'CH',
    'Austria': 'AT',
    'Portugal': 'PT',
    'Ireland': 'IE',
    'Luxembourg': 'LU',
    'Czech Republic': 'CZ',
    'Denmark': 'DK',
    'Finland': 'FI',
    'Greece': 'GR',
    'Hungary': 'HU',
    'Norway': 'NO',
    'Poland': 'PL',
    'Sweden': 'SE',
    'Slovakia': 'SK',
    'Slovenia': 'SI',
    'Croatia': 'HR',
    'Bulgaria': 'BG',
    'Romania': 'RO',
    'Estonia': 'EE',
    'Latvia': 'LV',
    'Lithuania': 'LT',
    'Cyprus': 'CY',
    'Malta': 'MT',
    'Russia': 'RU',
    'Australia': 'AU',
    'New Zealand': 'NZ',
    'South Africa': 'ZA',
    'Japan': 'JP',
    'Hong Kong': 'HK',
    'Singapore': 'SG',
    'South Korea': 'KR',
    'Taiwan': 'TW',
    'Thailand': 'TH',
    'Malaysia': 'MY'
  };
  
  return regionMap[regionName] || regionName.substring(0, 2).toUpperCase();
}

function isRegionDifficult(regionName) {
  const difficultRegions = [
    'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru',
    'Switzerland', 'Czech Republic', 'Greece', 'Hungary', 'Norway', 
    'Poland', 'Slovakia', 'Slovenia', 'Croatia', 'Bulgaria', 'Romania',
    'Estonia', 'Latvia', 'Lithuania', 'Cyprus', 'Malta', 'Russia',
    'South Africa', 'Japan', 'Hong Kong', 'South Korea', 'Taiwan', 
    'Thailand', 'Malaysia'
  ];
  
  return difficultRegions.includes(regionName);
}

function hasGiftCards(regionName) {
  const giftCardRegions = [
    'United States', 'USA', 'Canada', 'United Kingdom', 'UK', 'Germany',
    'France', 'Spain', 'Italy', 'Netherlands', 'Australia', 'Mexico',
    'Brazil', 'Argentina', 'Russia', 'South Africa', 'Japan', 'Hong Kong'
  ];
  
  return giftCardRegions.includes(regionName);
}

async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
    console.log(`[ESHOP-PRICES] Rate limiting: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

module.exports = {
  searchGameOnEshopPrices
};