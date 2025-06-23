const axios = require('axios');
const { convertToSGD } = require('./currencyConverter');

// Enhanced region data with purchase difficulty and gift card availability
const REGIONS = {
  'US': { 
    code: 'US', 
    currency: 'USD', 
    name: 'United States',
    country: 'US',
    apiRegion: 'americas',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.com/us/store/'
  },
  'CA': { 
    code: 'CA', 
    currency: 'CAD', 
    name: 'Canada',
    country: 'CA',
    apiRegion: 'americas',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.com/ca/store/'
  },
  'MX': { 
    code: 'MX', 
    currency: 'MXN', 
    name: 'Mexico',
    country: 'MX',
    apiRegion: 'americas',
    difficult: true,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.com/mx/store/'
  },
  'BR': { 
    code: 'BR', 
    currency: 'BRL', 
    name: 'Brazil',
    country: 'BR',
    apiRegion: 'americas',
    difficult: true,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.com/br/store/'
  },
  'AR': { 
    code: 'AR', 
    currency: 'ARS', 
    name: 'Argentina',
    country: 'AR',
    apiRegion: 'americas',
    difficult: true,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.com/ar/store/'
  },
  'CL': { 
    code: 'CL', 
    currency: 'CLP', 
    name: 'Chile',
    country: 'CL',
    apiRegion: 'americas',
    difficult: true,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.com/cl/store/'
  },
  'GB': { 
    code: 'GB', 
    currency: 'GBP', 
    name: 'United Kingdom',
    country: 'GB',
    apiRegion: 'europe',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.co.uk/Nintendo-eShop/'
  },
  'DE': { 
    code: 'DE', 
    currency: 'EUR', 
    name: 'Germany',
    country: 'DE',
    apiRegion: 'europe',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.de/Nintendo-eShop/'
  },
  'FR': { 
    code: 'FR', 
    currency: 'EUR', 
    name: 'France',
    country: 'FR',
    apiRegion: 'europe',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.fr/Nintendo-eShop/'
  },
  'ES': { 
    code: 'ES', 
    currency: 'EUR', 
    name: 'Spain',
    country: 'ES',
    apiRegion: 'europe',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.es/Nintendo-eShop/'
  },
  'IT': { 
    code: 'IT', 
    currency: 'EUR', 
    name: 'Italy',
    country: 'IT',
    apiRegion: 'europe',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.it/Nintendo-eShop/'
  },
  'NL': { 
    code: 'NL', 
    currency: 'EUR', 
    name: 'Netherlands',
    country: 'NL',
    apiRegion: 'europe',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.nl/Nintendo-eShop/'
  },
  'BE': { 
    code: 'BE', 
    currency: 'EUR', 
    name: 'Belgium',
    country: 'BE',
    apiRegion: 'europe',
    difficult: false,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.be/Nintendo-eShop/'
  },
  'AT': { 
    code: 'AT', 
    currency: 'EUR', 
    name: 'Austria',
    country: 'AT',
    apiRegion: 'europe',
    difficult: false,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.at/Nintendo-eShop/'
  },
  'CH': { 
    code: 'CH', 
    currency: 'CHF', 
    name: 'Switzerland',
    country: 'CH',
    apiRegion: 'europe',
    difficult: true,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.ch/Nintendo-eShop/'
  },
  'NO': { 
    code: 'NO', 
    currency: 'NOK', 
    name: 'Norway',
    country: 'NO',
    apiRegion: 'europe',
    difficult: true,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.no/Nintendo-eShop/'
  },
  'SE': { 
    code: 'SE', 
    currency: 'SEK', 
    name: 'Sweden',
    country: 'SE',
    apiRegion: 'europe',
    difficult: false,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.se/Nintendo-eShop/'
  },
  'DK': { 
    code: 'DK', 
    currency: 'DKK', 
    name: 'Denmark',
    country: 'DK',
    apiRegion: 'europe',
    difficult: false,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.dk/Nintendo-eShop/'
  },
  'JP': { 
    code: 'JP', 
    currency: 'JPY', 
    name: 'Japan',
    country: 'JP',
    apiRegion: 'asia',
    difficult: true,
    giftCards: true,
    nintendoStore: 'https://store-jp.nintendo.com/'
  },
  'AU': { 
    code: 'AU', 
    currency: 'AUD', 
    name: 'Australia',
    country: 'AU',
    apiRegion: 'oceania',
    difficult: false,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.com.au/nintendo-eshop'
  },
  'NZ': { 
    code: 'NZ', 
    currency: 'NZD', 
    name: 'New Zealand',
    country: 'NZ',
    apiRegion: 'oceania',
    difficult: false,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.co.nz/nintendo-eshop'
  },
  'SG': { 
    code: 'SG', 
    currency: 'SGD', 
    name: 'Singapore',
    country: 'SG',
    apiRegion: 'asia',
    difficult: false,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.com.sg/nintendo-eshop'
  },
  'HK': { 
    code: 'HK', 
    currency: 'HKD', 
    name: 'Hong Kong',
    country: 'HK',
    apiRegion: 'asia',
    difficult: true,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.com.hk/nintendo-eshop'
  },
  'KR': { 
    code: 'KR', 
    currency: 'KRW', 
    name: 'South Korea',
    country: 'KR',
    apiRegion: 'asia',
    difficult: true,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.co.kr/nintendo-eshop'
  },
  'TW': { 
    code: 'TW', 
    currency: 'TWD', 
    name: 'Taiwan',
    country: 'TW',
    apiRegion: 'asia',
    difficult: true,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.tw/nintendo-eshop'
  },
  'MY': { 
    code: 'MY', 
    currency: 'MYR', 
    name: 'Malaysia',
    country: 'MY',
    apiRegion: 'asia',
    difficult: true,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.com.my/nintendo-eshop'
  },
  'TH': { 
    code: 'TH', 
    currency: 'THB', 
    name: 'Thailand',
    country: 'TH',
    apiRegion: 'asia',
    difficult: true,
    giftCards: false,
    nintendoStore: 'https://www.nintendo.co.th/nintendo-eshop'
  },
  'RU': { 
    code: 'RU', 
    currency: 'RUB', 
    name: 'Russia',
    country: 'RU',
    apiRegion: 'europe',
    difficult: true,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.ru/Nintendo-eShop/'
  },
  'ZA': { 
    code: 'ZA', 
    currency: 'ZAR', 
    name: 'South Africa',
    country: 'ZA',
    apiRegion: 'africa',
    difficult: true,
    giftCards: true,
    nintendoStore: 'https://www.nintendo.co.za/nintendo-eshop'
  }
};

async function searchGame(gameName) {
  console.log(`[REAL] Searching for game: ${gameName}`);
  
  const prices = [];
  let gameFound = null;
  
  // Step 1: Search for the game using Nintendo Europe's search API
  try {
    gameFound = await searchGameInNintendoEurope(gameName);
    if (!gameFound) {
      console.log(`[REAL] No game found for: ${gameName}`);
      return [];
    }
    
    console.log(`[REAL] Found game: ${gameFound.title} (${gameFound.nsuid})`);
  } catch (error) {
    console.log(`[REAL] Game search failed: ${error.message}`);
    return [];
  }
  
  // Step 2: Get prices for this game across all regions
  const pricePromises = Object.entries(REGIONS).map(([regionCode, region]) =>
    getPriceForRegion(gameFound, region, regionCode)
  );
  
  const results = await Promise.allSettled(pricePromises);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      prices.push(result.value);
    } else if (result.status === 'rejected') {
      const regionCode = Object.keys(REGIONS)[index];
      console.log(`[REAL] Failed to get price for ${regionCode}: ${result.reason.message}`);
    }
  });
  
  console.log(`[REAL] Successfully retrieved ${prices.length} prices for ${gameFound.title}`);
  
  // Sort by SGD price and return top 25
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

async function searchGameInNintendoEurope(gameName) {
  const searchUrl = `https://searching.nintendo-europe.com/en/select`;
  
  try {
    const response = await axios.get(searchUrl, {
      params: {
        q: gameName,
        fq: 'type:GAME AND system_type:nintendoswitch*',
        rows: 20,
        start: 0,
        sort: 'popularity desc',
        wt: 'json'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    });
    
    const games = response.data?.response?.docs || [];
    if (games.length === 0) {
      return null;
    }
    
    // Find the best matching game using fuzzy matching
    const bestMatch = findBestGameMatch(gameName, games);
    
    if (!bestMatch) {
      return null;
    }
    
    return {
      title: bestMatch.title,
      nsuid: bestMatch.nsuid_txt?.[0],
      productCode: bestMatch.product_code_txt?.[0],
      image: bestMatch.image_url,
      developer: bestMatch.developer,
      publisher: bestMatch.publisher
    };
    
  } catch (error) {
    console.log(`Nintendo Europe search error: ${error.message}`);
    throw error;
  }
}

function findBestGameMatch(searchTerm, games) {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  
  // Define scoring criteria
  const calculateScore = (game) => {
    const title = (game.title || '').toLowerCase();
    let score = 0;
    
    // Exact match gets highest score
    if (title === normalizedSearch) {
      return 1000;
    }
    
    // Title contains search term
    if (title.includes(normalizedSearch)) {
      score += 500;
    }
    
    // Search term contains title (for shorter titles)
    if (normalizedSearch.includes(title)) {
      score += 300;
    }
    
    // Word-by-word matching
    const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);
    const titleWords = title.split(' ').filter(w => w.length > 2);
    
    searchWords.forEach(searchWord => {
      titleWords.forEach(titleWord => {
        if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
          score += 100;
        }
      });
    });
    
    // Popular games get slight boost
    if (game.popularity) {
      score += Math.min(game.popularity / 100, 50);
    }
    
    // First-party Nintendo games get boost
    const publisher = (game.publisher || '').toLowerCase();
    if (publisher.includes('nintendo')) {
      score += 25;
    }
    
    return score;
  };
  
  // Score all games and find the best match
  const scoredGames = games.map(game => ({
    game,
    score: calculateScore(game)
  }));
  
  // Sort by score and return the best match if it meets minimum threshold
  scoredGames.sort((a, b) => b.score - a.score);
  
  const bestMatch = scoredGames[0];
  
  // Only return if score is above threshold
  if (bestMatch && bestMatch.score > 50) {
    console.log(`[REAL] Best match: "${bestMatch.game.title}" (score: ${bestMatch.score})`);
    return bestMatch.game;
  }
  
  console.log(`[REAL] No good match found for "${searchTerm}". Best was "${scoredGames[0]?.game?.title}" with score ${scoredGames[0]?.score}`);
  return null;
}

async function getPriceForRegion(game, region, regionCode) {
  // Add delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  try {
    // Try Nintendo's price API
    const priceData = await getNintendoPriceAPI(game.nsuid, region);
    
    if (priceData && priceData.price > 0) {
      const sgdPrice = await convertToSGD(priceData.price, region.currency);
      
      return {
        region: region.name,
        regionCode: regionCode,
        originalPrice: priceData.price,
        currency: region.currency,
        sgdPrice: sgdPrice,
        title: game.title,
        discount: priceData.discount || 0,
        difficult: region.difficult,
        giftCards: region.giftCards,
        storeUrl: `${region.nintendoStore}${game.productCode || ''}`
      };
    }
    
  } catch (error) {
    console.log(`Price fetch error for ${regionCode}: ${error.message}`);
  }
  
  return null;
}

async function getNintendoPriceAPI(nsuid, region) {
  if (!nsuid) {
    console.log(`[PRICE] No NSUID for ${region.country}`);
    return null;
  }
  
  try {
    // Nintendo's price API endpoint
    const priceUrl = `https://api.ec.nintendo.com/v1/price`;
    
    console.log(`[PRICE] Fetching price for ${region.country}: ${priceUrl}?country=${region.country}&ids=${nsuid}`);
    
    const response = await axios.get(priceUrl, {
      params: {
        country: region.country,
        lang: 'en',
        ids: nsuid
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 8000
    });
    
    console.log(`[PRICE] Response for ${region.country}:`, response.status, response.data);
    
    const priceInfo = response.data?.prices?.[0];
    if (!priceInfo) {
      console.log(`[PRICE] No price info for ${region.country}`);
      return null;
    }
    
    const regularPrice = priceInfo.regular_price?.amount;
    const discountPrice = priceInfo.discount_price?.amount;
    
    if (!regularPrice) {
      console.log(`[PRICE] No regular price for ${region.country}`);
      return null;
    }
    
    const price = discountPrice || regularPrice;
    const discount = discountPrice ? 
      Math.round((1 - discountPrice / regularPrice) * 100) : 0;
    
    console.log(`[PRICE] Found price for ${region.country}: ${price / 100} ${region.currency}`);
    
    return {
      price: price / 100, // Convert from cents
      discount: discount
    };
    
  } catch (error) {
    console.log(`[PRICE] API error for ${region.country}: ${error.message}`);
    
    // Try fallback method for regions without official API
    return await getFallbackPrice(nsuid, region);
  }
}

async function getFallbackPrice(nsuid, region) {
  try {
    // Alternative approach: scrape regional Nintendo store pages
    const storeUrl = `${region.nintendoStore}${nsuid}`;
    
    const response = await axios.get(storeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });
    
    // This would require parsing HTML for price information
    // Implementation depends on each region's store structure
    // For now, return null to use other methods
    return null;
    
  } catch (error) {
    return null;
  }
}

module.exports = { searchGame, REGIONS };