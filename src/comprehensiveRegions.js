// Comprehensive regional support using dynamic getActiveShops() + additional regions
const axios = require('axios');
const { convertToSGD } = require('./currencyConverter');
const { getActiveShops } = require('nintendo-switch-eshop');

// Cache for dynamic regions (1 hour)
let dynamicRegionsCache = null;
let regionsCacheExpiry = 0;

// Regional metadata for purchase difficulty and gift card availability
const REGION_METADATA = {
  // Easy regions with gift card support
  'US': { difficult: false, giftCards: true },
  'CA': { difficult: false, giftCards: true },
  'GB': { difficult: false, giftCards: true },
  'DE': { difficult: false, giftCards: true },
  'FR': { difficult: false, giftCards: true },
  'IT': { difficult: false, giftCards: true },
  'ES': { difficult: false, giftCards: true },
  'NL': { difficult: false, giftCards: true },
  'AU': { difficult: false, giftCards: true },
  'DK': { difficult: false, giftCards: false },
  'FI': { difficult: false, giftCards: false },
  'SE': { difficult: false, giftCards: false },
  'NZ': { difficult: false, giftCards: false },
  'AT': { difficult: false, giftCards: false },
  'PT': { difficult: false, giftCards: false },
  'IE': { difficult: false, giftCards: false },
  'LU': { difficult: false, giftCards: false },
  'BE': { difficult: false, giftCards: false },
  
  // Difficult regions with gift cards
  'MX': { difficult: true, giftCards: true },
  'BR': { difficult: true, giftCards: true },
  'AR': { difficult: true, giftCards: true },
  'RU': { difficult: true, giftCards: true },
  'ZA': { difficult: true, giftCards: true },
  'JP': { difficult: true, giftCards: true },
  'HK': { difficult: true, giftCards: true },
  
  // Difficult regions without gift cards (default for unlisted regions)
  // All other regions default to: { difficult: true, giftCards: false }
};

async function getDynamicNintendoRegions() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (dynamicRegionsCache && now < regionsCacheExpiry) {
    return dynamicRegionsCache;
  }
  
  console.log('[COMPREHENSIVE] Fetching dynamic regions from Nintendo API...');
  
  try {
    const activeShops = await getActiveShops();
    
    // Transform API data into comprehensive regions format
    const dynamicRegions = {};
    
    activeShops.forEach(shop => {
      const metadata = REGION_METADATA[shop.code] || { difficult: true, giftCards: false };
      
      dynamicRegions[shop.code] = {
        code: shop.code,
        currency: shop.currency,
        name: shop.country,
        difficult: metadata.difficult,
        giftCards: metadata.giftCards,
        api: shop.code === 'BR' ? 'library' : 'sales',
        region: shop.region
      };
    });
    
    // Add Hong Kong (has eShop but not in getActiveShops due to API limitations)
    dynamicRegions['HK'] = { 
      code: 'HK', 
      currency: 'HKD', 
      name: 'Hong Kong', 
      difficult: true, 
      giftCards: true, 
      api: 'direct' 
    };
    
    // Cache for 1 hour
    dynamicRegionsCache = dynamicRegions;
    regionsCacheExpiry = now + (60 * 60 * 1000);
    
    console.log(`[COMPREHENSIVE] Cached ${Object.keys(dynamicRegions).length} dynamic regions`);
    return dynamicRegions;
    
  } catch (error) {
    console.error(`[COMPREHENSIVE] Failed to fetch dynamic regions: ${error.message}`);
    
    // Return fallback regions if API fails
    throw new Error('Failed to fetch dynamic Nintendo regions');
  }
}

// Dynamic regions - will be populated when needed
let ALL_NINTENDO_REGIONS = null;

// Language mappings for sales API endpoints
const REGION_LANGUAGES = {
  'US': 'en', 'CA': 'en', 'GB': 'en', 'AU': 'en', 'NZ': 'en', 'ZA': 'en',
  'CZ': 'en', 'DK': 'en', 'FI': 'en', 'GR': 'en', 'HU': 'en', 'NO': 'en', 'PL': 'en', 'SE': 'en',
  'DE': 'de', 'CH': 'de',
  'FR': 'fr', 'BE': 'fr',
  'IT': 'it',
  'ES': 'es', 'MX': 'es', 'CO': 'es', 'AR': 'es', 'CL': 'es', 'PE': 'es',
  'NL': 'nl',
  'RU': 'ru',
  'PT': 'pt', 'BR': 'pt'
};

// Cache for comprehensive pricing (15 minutes)
const comprehensivePriceCache = new Map();
const COMPREHENSIVE_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

async function getComprehensivePricesForGame(game) {
  // Get dynamic regions first
  if (!ALL_NINTENDO_REGIONS) {
    ALL_NINTENDO_REGIONS = await getDynamicNintendoRegions();
  }
  
  console.log(`[COMPREHENSIVE] Fetching prices for: ${game.title} across ALL ${Object.keys(ALL_NINTENDO_REGIONS).length} regions`);
  
  const cacheKey = `comprehensive_${game.nsuid}`;
  const cached = comprehensivePriceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < COMPREHENSIVE_CACHE_DURATION) {
    console.log(`[COMPREHENSIVE] Using cached prices for "${game.title}"`);
    return cached.data;
  }
  
  const prices = [];
  
  // Discover regional NSUIDs
  const regionalNSUIDs = await discoverComprehensiveNSUIDs(game.title, game.nsuid);
  console.log(`[COMPREHENSIVE] Regional NSUIDs discovered:`, regionalNSUIDs);
  
  // Test all regions in parallel batches to avoid overwhelming the APIs
  const regionCodes = Object.keys(ALL_NINTENDO_REGIONS);
  const batchSize = 5; // Process 5 regions at a time
  
  for (let i = 0; i < regionCodes.length; i += batchSize) {
    const batch = regionCodes.slice(i, i + batchSize);
    console.log(`[COMPREHENSIVE] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(regionCodes.length/batchSize)}: ${batch.join(', ')}`);
    
    const batchPromises = batch.map(async (regionCode) => {
      const region = ALL_NINTENDO_REGIONS[regionCode];
      
      // Try different NSUIDs for this region
      const nsuidsToTry = [
        game.nsuid, // Original NSUID
        regionalNSUIDs.americas,
        regionalNSUIDs.europe, 
        regionalNSUIDs.asia,
        regionalNSUIDs.japan
      ].filter(Boolean).filter((nsuid, index, arr) => arr.indexOf(nsuid) === index); // Remove duplicates
      
      for (const nsuid of nsuidsToTry) {
        try {
          const price = await fetchPriceForRegionComprehensive(nsuid, regionCode, game.title);
          if (price) {
            return price;
          }
        } catch (error) {
          // Continue to next NSUID
        }
        
        // Small delay between NSUID attempts
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return null;
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    });
    
    // Delay between batches to respect rate limits
    if (i + batchSize < regionCodes.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`[COMPREHENSIVE] Found prices in ${prices.length} regions out of ${regionCodes.length} possible regions`);
  
  const sortedPrices = prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice);
  
  // Cache results
  comprehensivePriceCache.set(cacheKey, {
    data: sortedPrices,
    timestamp: Date.now()
  });
  
  return sortedPrices;
}

async function fetchPriceForRegionComprehensive(nsuid, regionCode, gameTitle) {
  const region = ALL_NINTENDO_REGIONS[regionCode];
  if (!region || !nsuid) return null;
  
  try {
    // Use direct price API for all regions (most reliable)
    const url = `https://api.ec.nintendo.com/v1/price?country=${regionCode}&ids=${nsuid}&lang=en`;
    
    const response = await axios.get(url, {
      timeout: 8000,
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
      return null;
    }
    
    const regularPrice = parseFloat(priceInfo.regular_price.raw_value);
    const discountPrice = priceInfo.discount_price ? parseFloat(priceInfo.discount_price.raw_value) : null;
    
    if (isNaN(regularPrice) || regularPrice <= 0) return null;
    
    const finalPrice = discountPrice || regularPrice;
    const discount = discountPrice ? Math.round((1 - discountPrice / regularPrice) * 100) : 0;
    
    const sgdPrice = await convertToSGD(finalPrice, region.currency);
    
    if (sgdPrice > 0) {
      console.log(`[COMPREHENSIVE] ✅ ${regionCode}: ${finalPrice} ${region.currency} = S$${sgdPrice.toFixed(2)}${discount > 0 ? ` (-${discount}%)` : ''}`);
      
      return {
        region: region.name,
        regionCode: regionCode,
        originalPrice: finalPrice,
        currency: region.currency,
        sgdPrice: sgdPrice,
        title: gameTitle,
        discount: discount,
        difficult: region.difficult,
        giftCards: region.giftCards,
        source: 'comprehensive_api'
      };
    }
    
    return null;
    
  } catch (error) {
    // Silently fail for individual regions
    return null;
  }
}

async function discoverComprehensiveNSUIDs(gameTitle, originalNSUID) {
  // Use existing regional NSUID discovery
  try {
    const { findRegionalNSUIDs } = require('./eshopScraper');
    const nsuids = await findRegionalNSUIDs(gameTitle, originalNSUID);
    
    // Add original NSUID as fallback
    nsuids.original = originalNSUID;
    
    return nsuids;
  } catch (error) {
    console.log(`[COMPREHENSIVE] NSUID discovery error: ${error.message}`);
    return { original: originalNSUID, americas: originalNSUID };
  }
}

// Get all available regions count
function getAllRegionsCount() {
  return Object.keys(ALL_NINTENDO_REGIONS).length;
}

// Get regions by type
function getRegionsByType() {
  const types = { library: [], sales: [], direct: [] };
  
  Object.values(ALL_NINTENDO_REGIONS).forEach(region => {
    types[region.api].push(region);
  });
  
  return types;
}

module.exports = {
  ALL_NINTENDO_REGIONS,
  getComprehensivePricesForGame,
  getAllRegionsCount,
  getRegionsByType,
  fetchPriceForRegionComprehensive
};