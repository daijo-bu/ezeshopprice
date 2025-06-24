const { 
  getQueriedGamesAmerica,
  getQueriedGamesBrazil,
  getGamesEurope,
  getGamesJapan,
  getPrices,
  parseNSUID,
  Region,
  getActiveShops
} = require('nintendo-switch-eshop');
const { convertToSGD } = require('./currencyConverter');
const axios = require('axios');

// Enhanced regions including direct API access to missing regions
const ENHANCED_REGIONS = {
  // Standard regions (via getActiveShops)
  ...require('./eshopScraper').getActiveShopsWithCache(),
  
  // Direct API regions (not available via standard API)
  'HK': { code: 'HK', currency: 'HKD', name: 'Hong Kong', difficult: true, giftCards: true, directAPI: true },
  'SG': { code: 'SG', currency: 'SGD', name: 'Singapore', difficult: false, giftCards: false, directAPI: true },
  'KR': { code: 'KR', currency: 'KRW', name: 'South Korea', difficult: true, giftCards: false, directAPI: true },
  'TW': { code: 'TW', currency: 'TWD', name: 'Taiwan', difficult: true, giftCards: false, directAPI: true },
  'TH': { code: 'TH', currency: 'THB', name: 'Thailand', difficult: true, giftCards: false, directAPI: true },
  'MY': { code: 'MY', currency: 'MYR', name: 'Malaysia', difficult: true, giftCards: false, directAPI: true }
};

// Regional NSUID discovery using direct Nintendo APIs
const REGIONAL_GAME_SOURCES = {
  // Japan games with NSUIDs
  JP: {
    url: 'https://www.nintendo.co.jp/data/software/xml/switch.xml',
    type: 'xml',
    extractNSUID: (game) => {
      const match = game.LinkURL?.match(/\/titles\/(\d{14})/);
      return match ? match[1] : null;
    },
    extractTitle: (game) => game.TitleName
  },
  
  // US games via existing API
  US: {
    useExistingAPI: true,
    api: getQueriedGamesAmerica
  },
  
  // Europe games via existing API  
  EU: {
    useExistingAPI: true,
    api: getGamesEurope
  }
};

// 15-minute cache for game pricing data
const priceCache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Game discovery cache (1 hour)
const gameDiscoveryCache = new Map();
const GAME_DISCOVERY_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function searchGamesEnhanced(gameName) {
  console.log(`[ENHANCED] Searching for games matching: ${gameName}`);
  
  const cacheKey = `search_${gameName.toLowerCase()}`;
  const cached = gameDiscoveryCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < GAME_DISCOVERY_CACHE_DURATION) {
    console.log(`[ENHANCED] Using cached search results for "${gameName}"`);
    return cached.data;
  }
  
  try {
    // Use existing search logic but with enhanced regional NSUID discovery
    const { searchGames } = require('./eshopScraper');
    const result = await searchGames(gameName);
    
    if (result.type === 'prices' || result.type === 'multiple_options') {
      // Enhance with comprehensive regional pricing
      if (result.type === 'prices') {
        result.prices = await getEnhancedPricesForGame(result.game);
      } else if (result.type === 'multiple_options') {
        // Add enhanced regional NSUIDs to each game option
        for (const game of result.games) {
          game.regionalNSUIDs = await discoverAllRegionalNSUIDs(game.title, game.nsuid);
        }
      }
    }
    
    // Cache the enhanced result
    gameDiscoveryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    console.error(`[ENHANCED] Search error: ${error.message}`);
    return {
      type: 'error',
      message: 'Sorry, there was an error searching for games. Please try again later.'
    };
  }
}

async function getEnhancedPricesForGame(game) {
  console.log(`[ENHANCED] Fetching comprehensive prices for: ${game.title}`);
  
  const cacheKey = `prices_${game.nsuid}`;
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`[ENHANCED] Using cached prices for "${game.title}"`);
    return cached.data;
  }
  
  const prices = [];
  
  // Get standard regions via existing system
  const { getActiveShopsWithCache } = require('./eshopScraper');
  const activeShops = await getActiveShopsWithCache();
  
  // Discover all regional NSUIDs for this game
  const regionalNSUIDs = await discoverAllRegionalNSUIDs(game.title, game.nsuid);
  
  console.log(`[ENHANCED] Found regional NSUIDs:`, regionalNSUIDs);
  
  // Phase 1: Standard regions via existing system
  console.log(`[ENHANCED] Phase 1: Testing ${activeShops.length} standard regions...`);
  
  for (const shop of activeShops) {
    const price = await fetchPriceForShop(regionalNSUIDs.americas || game.nsuid, shop, game.title);
    if (price) prices.push(price);
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Phase 2: Enhanced regions via direct API
  const enhancedRegions = ['HK', 'SG', 'KR', 'TW', 'TH', 'MY'];
  console.log(`[ENHANCED] Phase 2: Testing ${enhancedRegions.length} enhanced regions...`);
  
  for (const regionCode of enhancedRegions) {
    const region = ENHANCED_REGIONS[regionCode];
    if (!region) continue;
    
    // Try different regional NSUIDs for this region
    const nsuidsToTry = [
      regionalNSUIDs.asia,
      regionalNSUIDs.japan,
      regionalNSUIDs.americas,
      game.nsuid
    ].filter(Boolean);
    
    for (const nsuid of nsuidsToTry) {
      const price = await fetchPriceForRegionDirect(nsuid, regionCode, game.title);
      if (price) {
        prices.push(price);
        break; // Found price for this region, no need to try other NSUIDs
      }
      
      // Rate limiting between NSUID attempts
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Rate limiting between regions
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`[ENHANCED] Total prices found: ${prices.length} across ${activeShops.length + enhancedRegions.length} possible regions`);
  
  const sortedPrices = prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice);
  
  // Cache the results
  priceCache.set(cacheKey, {
    data: sortedPrices,
    timestamp: Date.now()
  });
  
  return sortedPrices;
}

async function discoverAllRegionalNSUIDs(gameTitle, originalNSUID) {
  console.log(`[ENHANCED] Discovering all regional NSUIDs for: ${gameTitle}`);
  
  const cacheKey = `nsuid_${gameTitle.toLowerCase()}`;
  const cached = gameDiscoveryCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < GAME_DISCOVERY_CACHE_DURATION) {
    console.log(`[ENHANCED] Using cached NSUIDs for "${gameTitle}"`);
    return cached.data;
  }
  
  const regionalNSUIDs = {
    americas: originalNSUID,
    original: originalNSUID
  };
  
  try {
    // Use existing regional discovery from eshopScraper
    const { findRegionalNSUIDs } = require('./eshopScraper');
    const existingNSUIDs = await findRegionalNSUIDs(gameTitle, originalNSUID);
    Object.assign(regionalNSUIDs, existingNSUIDs);
    
    // Enhanced discovery via direct APIs
    
    // Japan games discovery
    try {
      const japanNSUID = await findGameInJapanAPI(gameTitle);
      if (japanNSUID) {
        regionalNSUIDs.japan = japanNSUID;
        regionalNSUIDs.asia = japanNSUID; // Japan NSUID often works for other Asian regions
      }
    } catch (error) {
      console.log(`[ENHANCED] Japan API discovery failed: ${error.message}`);
    }
    
    // More aggressive search strategies could be added here
    
  } catch (error) {
    console.log(`[ENHANCED] Regional NSUID discovery error: ${error.message}`);
  }
  
  console.log(`[ENHANCED] Regional NSUIDs discovered:`, regionalNSUIDs);
  
  // Cache the results
  gameDiscoveryCache.set(cacheKey, {
    data: regionalNSUIDs,
    timestamp: Date.now()
  });
  
  return regionalNSUIDs;
}

async function findGameInJapanAPI(gameTitle) {
  try {
    console.log(`[ENHANCED] Searching Japan API for: ${gameTitle}`);
    
    const response = await axios.get('https://www.nintendo.co.jp/data/software/xml/switch.xml', {
      timeout: 10000
    });
    
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    
    const games = result.TitleInfoList.TitleInfo;
    
    // Search for matching game
    const normalizedTitle = gameTitle.toLowerCase();
    
    for (const game of games) {
      const jpTitle = (game.TitleName?.[0] || '').toLowerCase();
      
      // Try various matching strategies
      if (jpTitle.includes(normalizedTitle) || 
          normalizedTitle.includes(jpTitle) ||
          calculateSimilarity(normalizedTitle, jpTitle) > 0.7) {
        
        // Extract NSUID from LinkURL
        const linkURL = game.LinkURL?.[0];
        if (linkURL) {
          const match = linkURL.match(/\/titles\/(\d{14})/);
          if (match) {
            console.log(`[ENHANCED] Found Japan NSUID ${match[1]} for "${jpTitle}"`);
            return match[1];
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.log(`[ENHANCED] Japan API search failed: ${error.message}`);
    return null;
  }
}

async function fetchPriceForRegionDirect(nsuid, regionCode, gameTitle) {
  if (!nsuid || !regionCode) return null;
  
  try {
    const url = `https://api.ec.nintendo.com/v1/price?country=${regionCode}&ids=${nsuid}&lang=en`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const data = response.data;
    
    if (!data.prices || data.prices.length === 0) {
      return null;
    }
    
    const priceInfo = data.prices[0];
    
    if (priceInfo.sales_status !== 'onsale') {
      console.log(`[ENHANCED] Game not available in ${regionCode}: ${priceInfo.sales_status}`);
      return null;
    }
    
    const regularPrice = parseFloat(priceInfo.regular_price.raw_value);
    if (isNaN(regularPrice) || regularPrice <= 0) return null;
    
    const region = ENHANCED_REGIONS[regionCode];
    const sgdPrice = await convertToSGD(regularPrice, region.currency);
    
    if (sgdPrice > 0) {
      console.log(`[ENHANCED] ✅ Got price for ${regionCode} using NSUID ${nsuid}: ${regularPrice} ${region.currency} = S$${sgdPrice.toFixed(2)}`);
      
      return {
        region: region.name,
        regionCode: regionCode,
        originalPrice: regularPrice,
        currency: region.currency,
        sgdPrice: sgdPrice,
        title: gameTitle,
        discount: 0, // Could be enhanced to detect discounts
        difficult: region.difficult,
        giftCards: region.giftCards,
        source: 'direct_api'
      };
    }
    
    return null;
    
  } catch (error) {
    // Silently fail for individual regions
    return null;
  }
}

// Helper function from eshopScraper
async function fetchPriceForShop(nsuid, shop, gameTitle) {
  const { fetchPriceForShop } = require('./eshopScraper');
  return fetchPriceForShop(nsuid, shop, gameTitle);
}

// Simple similarity calculation
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Legacy compatibility
async function searchGameByNSUID(nsuid) {
  const { searchGameByNSUID } = require('./eshopScraper');
  return searchGameByNSUID(nsuid);
}

module.exports = { 
  searchGamesEnhanced, 
  searchGameByNSUID,
  getEnhancedPricesForGame,
  discoverAllRegionalNSUIDs
};