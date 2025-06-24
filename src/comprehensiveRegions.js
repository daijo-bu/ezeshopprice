// Comprehensive regional support combining library + direct APIs
const axios = require('axios');
const { convertToSGD } = require('./currencyConverter');

// Official Nintendo eShop regions (verified via nintendo-switch-eshop library v8.0.1)
// Total: 43 officially supported regions (8 Americas + 34 Europe/Oceania + 1 Asia)
const ALL_NINTENDO_REGIONS = {
  // Americas (8 regions)
  'US': { code: 'US', currency: 'USD', name: 'United States', difficult: false, giftCards: true, api: 'sales' },
  'CA': { code: 'CA', currency: 'CAD', name: 'Canada', difficult: false, giftCards: true, api: 'sales' },
  'MX': { code: 'MX', currency: 'MXN', name: 'Mexico', difficult: true, giftCards: true, api: 'sales' },
  'BR': { code: 'BR', currency: 'BRL', name: 'Brazil', difficult: true, giftCards: true, api: 'library' },
  'AR': { code: 'AR', currency: 'ARS', name: 'Argentina', difficult: true, giftCards: true, api: 'sales' },
  'CL': { code: 'CL', currency: 'CLP', name: 'Chile', difficult: true, giftCards: false, api: 'sales' },
  'CO': { code: 'CO', currency: 'COP', name: 'Colombia', difficult: true, giftCards: false, api: 'sales' },
  'PE': { code: 'PE', currency: 'PEN', name: 'Peru', difficult: true, giftCards: false, api: 'sales' },
  
  // Europe & Oceania (34 regions)
  'GB': { code: 'GB', currency: 'GBP', name: 'United Kingdom', difficult: false, giftCards: true, api: 'sales' },
  'DE': { code: 'DE', currency: 'EUR', name: 'Germany', difficult: false, giftCards: true, api: 'sales' },
  'FR': { code: 'FR', currency: 'EUR', name: 'France', difficult: false, giftCards: true, api: 'sales' },
  'IT': { code: 'IT', currency: 'EUR', name: 'Italy', difficult: false, giftCards: true, api: 'sales' },
  'ES': { code: 'ES', currency: 'EUR', name: 'Spain', difficult: false, giftCards: true, api: 'sales' },
  'NL': { code: 'NL', currency: 'EUR', name: 'Netherlands', difficult: false, giftCards: true, api: 'sales' },
  'BE': { code: 'BE', currency: 'EUR', name: 'Belgium', difficult: false, giftCards: false, api: 'sales' },
  'CH': { code: 'CH', currency: 'CHF', name: 'Switzerland', difficult: true, giftCards: false, api: 'sales' },
  'AT': { code: 'AT', currency: 'EUR', name: 'Austria', difficult: false, giftCards: false, api: 'sales' },
  'PT': { code: 'PT', currency: 'EUR', name: 'Portugal', difficult: false, giftCards: false, api: 'sales' },
  'IE': { code: 'IE', currency: 'EUR', name: 'Ireland', difficult: false, giftCards: false, api: 'sales' },
  'LU': { code: 'LU', currency: 'EUR', name: 'Luxembourg', difficult: false, giftCards: false, api: 'sales' },
  'CZ': { code: 'CZ', currency: 'CZK', name: 'Czech Republic', difficult: true, giftCards: false, api: 'sales' },
  'DK': { code: 'DK', currency: 'DKK', name: 'Denmark', difficult: false, giftCards: false, api: 'sales' },
  'FI': { code: 'FI', currency: 'EUR', name: 'Finland', difficult: false, giftCards: false, api: 'sales' },
  'GR': { code: 'GR', currency: 'EUR', name: 'Greece', difficult: true, giftCards: false, api: 'sales' },
  'HU': { code: 'HU', currency: 'HUF', name: 'Hungary', difficult: true, giftCards: false, api: 'sales' },
  'NO': { code: 'NO', currency: 'NOK', name: 'Norway', difficult: true, giftCards: false, api: 'sales' },
  'PL': { code: 'PL', currency: 'PLN', name: 'Poland', difficult: true, giftCards: false, api: 'sales' },
  'SE': { code: 'SE', currency: 'SEK', name: 'Sweden', difficult: false, giftCards: false, api: 'sales' },
  'SK': { code: 'SK', currency: 'EUR', name: 'Slovakia', difficult: true, giftCards: false, api: 'sales' },
  'SI': { code: 'SI', currency: 'EUR', name: 'Slovenia', difficult: true, giftCards: false, api: 'sales' },
  'HR': { code: 'HR', currency: 'EUR', name: 'Croatia', difficult: true, giftCards: false, api: 'sales' },
  'BG': { code: 'BG', currency: 'EUR', name: 'Bulgaria', difficult: true, giftCards: false, api: 'sales' },
  'RO': { code: 'RO', currency: 'EUR', name: 'Romania', difficult: true, giftCards: false, api: 'sales' },
  'EE': { code: 'EE', currency: 'EUR', name: 'Estonia', difficult: true, giftCards: false, api: 'sales' },
  'LV': { code: 'LV', currency: 'EUR', name: 'Latvia', difficult: true, giftCards: false, api: 'sales' },
  'LT': { code: 'LT', currency: 'EUR', name: 'Lithuania', difficult: true, giftCards: false, api: 'sales' },
  'CY': { code: 'CY', currency: 'EUR', name: 'Cyprus', difficult: true, giftCards: false, api: 'sales' },
  'MT': { code: 'MT', currency: 'EUR', name: 'Malta', difficult: true, giftCards: false, api: 'sales' },
  'RU': { code: 'RU', currency: 'RUB', name: 'Russia', difficult: true, giftCards: true, api: 'sales' },
  'AU': { code: 'AU', currency: 'AUD', name: 'Australia', difficult: false, giftCards: true, api: 'sales' },
  'NZ': { code: 'NZ', currency: 'NZD', name: 'New Zealand', difficult: false, giftCards: false, api: 'sales' },
  'ZA': { code: 'ZA', currency: 'ZAR', name: 'South Africa', difficult: true, giftCards: true, api: 'sales' },
  
  // Asia (1 region only - Japan is the only official Asian eShop)
  'JP': { code: 'JP', currency: 'JPY', name: 'Japan', difficult: true, giftCards: true, api: 'library' }
  
  // NOTE: Hong Kong, Singapore, South Korea, Taiwan, Thailand, Malaysia 
  // DO NOT have official Nintendo eShops as of 2024
  // They will get official support with Nintendo Switch 2 in 2025
};

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