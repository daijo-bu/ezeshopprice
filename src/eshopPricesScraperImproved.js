// Improved scraper for eshop-prices.com that reflects their exact data
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
    // Try multiple search strategies
    let gameUrl = await searchPopularGames(gameName);
    
    if (!gameUrl) {
      gameUrl = await searchOnSaleGames(gameName);
    }
    
    if (!gameUrl) {
      gameUrl = await searchRegularPages(gameName);
    }
    
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

async function searchPopularGames(gameName) {
  console.log(`[ESHOP-PRICES] Searching popular games for: ${gameName}`);
  
  await enforceRateLimit();
  
  try {
    const response = await axios.get('https://eshop-prices.com/games?sort=popularity&order=desc', {
      timeout: 10000,
      headers: getHeaders()
    });
    
    const $ = cheerio.load(response.data);
    return findMatchingGame($, gameName);
    
  } catch (error) {
    console.log(`[ESHOP-PRICES] Error searching popular games: ${error.message}`);
    return null;
  }
}

async function searchOnSaleGames(gameName) {
  console.log(`[ESHOP-PRICES] Searching on-sale games for: ${gameName}`);
  
  await enforceRateLimit();
  
  try {
    const response = await axios.get('https://eshop-prices.com/games?sort=discount&order=desc', {
      timeout: 10000,
      headers: getHeaders()
    });
    
    const $ = cheerio.load(response.data);
    return findMatchingGame($, gameName);
    
  } catch (error) {
    console.log(`[ESHOP-PRICES] Error searching on-sale games: ${error.message}`);
    return null;
  }
}

async function searchRegularPages(gameName) {
  console.log(`[ESHOP-PRICES] Searching regular game pages for: ${gameName}`);
  
  // Search through multiple pages
  for (let page = 1; page <= 5; page++) {
    try {
      await enforceRateLimit();
      
      const response = await axios.get(`https://eshop-prices.com/games?page=${page}`, {
        timeout: 10000,
        headers: getHeaders()
      });
      
      const $ = cheerio.load(response.data);
      const gameUrl = findMatchingGame($, gameName);
      
      if (gameUrl) {
        return gameUrl;
      }
      
    } catch (error) {
      console.log(`[ESHOP-PRICES] Error searching page ${page}: ${error.message}`);
      continue;
    }
  }
  
  return null;
}

function findMatchingGame($, gameName) {
  const normalizedSearch = gameName.toLowerCase().trim();
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 1);
  
  let bestMatch = null;
  let bestScore = 0;
  
  // Look for game links and titles
  $('a[href*="/games/"]').each((i, element) => {
    const $el = $(element);
    const href = $el.attr('href');
    
    if (!href || href.includes('/games?') || href.includes('#')) {
      return;
    }
    
    // Get title from link text, alt text, or nearby elements
    let title = $el.text().trim();
    
    if (!title) {
      title = $el.find('img').attr('alt') || '';
    }
    
    if (!title) {
      title = $el.closest('.game-item, .game-card').find('.title, .game-title').text().trim();
    }
    
    if (title) {
      const score = calculateMatchScore(normalizedSearch, title.toLowerCase());
      
      if (score > bestScore && score > 200) { // Minimum threshold
        bestScore = score;
        bestMatch = {
          url: href.startsWith('http') ? href : `https://eshop-prices.com${href}`,
          title: title,
          score: score
        };
      }
    }
  });
  
  if (bestMatch) {
    console.log(`[ESHOP-PRICES] Best match: "${bestMatch.title}" (score: ${bestMatch.score})`);
    return bestMatch.url;
  }
  
  return null;
}

async function scrapeGamePricing(gameUrl, originalGameName) {
  console.log(`[ESHOP-PRICES] Scraping pricing data from: ${gameUrl}`);
  
  await enforceRateLimit();
  
  try {
    const response = await axios.get(gameUrl, {
      timeout: 15000,
      headers: getHeaders()
    });
    
    const $ = cheerio.load(response.data);
    
    // Extract game title
    const gameTitle = $('h1').first().text().trim() || 
                     $('title').text().replace(' - eshop-prices.com', '').trim() || 
                     originalGameName;
    
    console.log(`[ESHOP-PRICES] Extracting prices for: ${gameTitle}`);
    
    const prices = [];
    
    // Countries to look for
    const countries = [
      'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru',
      'United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium', 
      'Switzerland', 'Austria', 'Portugal', 'Ireland', 'Luxembourg', 'Czech Republic',
      'Denmark', 'Finland', 'Greece', 'Hungary', 'Norway', 'Poland', 'Sweden',
      'Slovakia', 'Slovenia', 'Croatia', 'Bulgaria', 'Romania', 'Estonia', 'Latvia',
      'Lithuania', 'Cyprus', 'Malta', 'Russia', 'Australia', 'New Zealand', 'South Africa',
      'Japan', 'Hong Kong', 'Singapore', 'South Korea', 'Taiwan', 'Thailand', 'Malaysia'
    ];
    
    // Look through page content for pricing information
    const allElements = $('*').toArray();
    
    for (const element of allElements) {
      const $el = $(element);
      const text = $el.text();
      
      // Skip third-party sellers
      if (text.toLowerCase().includes('eneba') || 
          text.toLowerCase().includes('driffle') ||
          text.toLowerCase().includes('instant-gaming') ||
          text.toLowerCase().includes('g2a') ||
          text.toLowerCase().includes('kinguin')) {
        continue;
      }
      
      // Look for country names followed by prices
      for (const country of countries) {
        if (text.includes(country)) {
          // Look for price patterns
          const pricePatterns = [
            /[\$€£¥₩R]\s*[\d,]+\.?\d*/g,
            /[\d,]+\.?\d*\s*[\$€£¥₩R]/g,
            /\b\d{1,3}(,\d{3})*(\.\d{2})?\b/g
          ];
          
          for (const pattern of pricePatterns) {
            const matches = text.match(pattern);
            
            if (matches) {
              for (const match of matches) {
                try {
                  const currency = extractCurrencyFromPrice(match, country);
                  const price = parseFloat(match.replace(/[^\d.,]/g, '').replace(',', ''));
                  
                  if (!isNaN(price) && price > 0 && price < 1000) { // Reasonable price range
                    const sgdPrice = await convertToSGD(price, currency);
                    
                    if (sgdPrice > 0) {
                      // Check for discount
                      let discount = 0;
                      const discountMatch = text.match(/-(\d+)%/);
                      if (discountMatch) {
                        discount = parseInt(discountMatch[1]);
                      }
                      
                      prices.push({
                        region: country,
                        regionCode: getRegionCode(country),
                        originalPrice: price,
                        currency: currency,
                        sgdPrice: sgdPrice,
                        title: gameTitle,
                        discount: discount,
                        difficult: isRegionDifficult(country),
                        giftCards: hasGiftCards(country),
                        source: 'eshop-prices.com'
                      });
                      
                      console.log(`[ESHOP-PRICES] Found: ${country} - ${price} ${currency} = S$${sgdPrice.toFixed(2)}`);
                      break; // Take first valid price for this country
                    }
                  }
                } catch (err) {
                  // Skip problematic price extraction
                }
              }
            }
          }
        }
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
    const uniquePrices = prices
      .filter((price, index, arr) => 
        arr.findIndex(p => p.regionCode === price.regionCode) === index
      )
      .sort((a, b) => a.sgdPrice - b.sgdPrice);
    
    return {
      type: 'prices',
      game: { title: gameTitle },
      prices: uniquePrices
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
        score += 300;
      } else if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        score += 150;
      }
    });
  });
  
  // Bonus for matching all search words
  if (exactWordMatches >= searchWords.length && searchWords.length > 1) {
    score += 500;
  }
  
  return score;
}

function extractCurrencyFromPrice(priceText, country) {
  // First try symbol-based detection
  if (priceText.includes('$')) {
    // Determine which dollar based on country
    if (country === 'United States') return 'USD';
    if (country === 'Canada') return 'CAD';
    if (country === 'Australia') return 'AUD';
    if (country === 'New Zealand') return 'NZD';
    if (country === 'Hong Kong') return 'HKD';
    if (country === 'Singapore') return 'SGD';
    return 'USD'; // Default
  }
  
  if (priceText.includes('€')) return 'EUR';
  if (priceText.includes('£')) return 'GBP';
  if (priceText.includes('¥') || priceText.includes('￥')) return 'JPY';
  if (priceText.includes('₩') || priceText.includes('￦')) return 'KRW';
  if (priceText.includes('R')) return 'ZAR';
  
  // Country-based currency mapping
  const currencyMap = {
    'United States': 'USD', 'Canada': 'CAD', 'Mexico': 'MXN', 'Brazil': 'BRL',
    'Argentina': 'ARS', 'Chile': 'CLP', 'Colombia': 'COP', 'Peru': 'PEN',
    'United Kingdom': 'GBP', 'Germany': 'EUR', 'France': 'EUR', 'Spain': 'EUR',
    'Italy': 'EUR', 'Netherlands': 'EUR', 'Belgium': 'EUR', 'Switzerland': 'CHF',
    'Austria': 'EUR', 'Portugal': 'EUR', 'Ireland': 'EUR', 'Luxembourg': 'EUR',
    'Czech Republic': 'CZK', 'Denmark': 'DKK', 'Finland': 'EUR', 'Greece': 'EUR',
    'Hungary': 'HUF', 'Norway': 'NOK', 'Poland': 'PLN', 'Sweden': 'SEK',
    'Slovakia': 'EUR', 'Slovenia': 'EUR', 'Croatia': 'EUR', 'Bulgaria': 'EUR',
    'Romania': 'EUR', 'Estonia': 'EUR', 'Latvia': 'EUR', 'Lithuania': 'EUR',
    'Cyprus': 'EUR', 'Malta': 'EUR', 'Russia': 'RUB', 'Australia': 'AUD',
    'New Zealand': 'NZD', 'South Africa': 'ZAR', 'Japan': 'JPY',
    'Hong Kong': 'HKD', 'Singapore': 'SGD', 'South Korea': 'KRW',
    'Taiwan': 'TWD', 'Thailand': 'THB', 'Malaysia': 'MYR'
  };
  
  return currencyMap[country] || 'USD';
}

function getRegionCode(regionName) {
  const regionMap = {
    'United States': 'US', 'Canada': 'CA', 'Mexico': 'MX', 'Brazil': 'BR',
    'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO', 'Peru': 'PE',
    'United Kingdom': 'GB', 'Germany': 'DE', 'France': 'FR', 'Spain': 'ES',
    'Italy': 'IT', 'Netherlands': 'NL', 'Belgium': 'BE', 'Switzerland': 'CH',
    'Austria': 'AT', 'Portugal': 'PT', 'Ireland': 'IE', 'Luxembourg': 'LU',
    'Czech Republic': 'CZ', 'Denmark': 'DK', 'Finland': 'FI', 'Greece': 'GR',
    'Hungary': 'HU', 'Norway': 'NO', 'Poland': 'PL', 'Sweden': 'SE',
    'Slovakia': 'SK', 'Slovenia': 'SI', 'Croatia': 'HR', 'Bulgaria': 'BG',
    'Romania': 'RO', 'Estonia': 'EE', 'Latvia': 'LV', 'Lithuania': 'LT',
    'Cyprus': 'CY', 'Malta': 'MT', 'Russia': 'RU', 'Australia': 'AU',
    'New Zealand': 'NZ', 'South Africa': 'ZA', 'Japan': 'JP',
    'Hong Kong': 'HK', 'Singapore': 'SG', 'South Korea': 'KR',
    'Taiwan': 'TW', 'Thailand': 'TH', 'Malaysia': 'MY'
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
    'United States', 'Canada', 'United Kingdom', 'Germany',
    'France', 'Spain', 'Italy', 'Netherlands', 'Australia', 'Mexico',
    'Brazil', 'Argentina', 'Russia', 'South Africa', 'Japan', 'Hong Kong'
  ];
  
  return giftCardRegions.includes(regionName);
}

function getHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  };
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