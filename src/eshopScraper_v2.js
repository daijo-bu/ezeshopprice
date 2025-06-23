const axios = require('axios');
const { convertToSGD } = require('./currencyConverter');

// Nintendo API endpoints that are more reliable
const NINTENDO_API_ENDPOINTS = {
  'US': 'https://www.nintendo.com/us/store/products/',
  'EU': 'https://api.ec.nintendo.com/v1/price',
  'JP': 'https://api.ec.nintendo.com/v1/price'
};

const REGIONS = {
  'US': { code: 'US', currency: 'USD', name: 'United States', country: 'US' },
  'CA': { code: 'CA', currency: 'CAD', name: 'Canada', country: 'CA' },
  'MX': { code: 'MX', currency: 'MXN', name: 'Mexico', country: 'MX' },
  'BR': { code: 'BR', currency: 'BRL', name: 'Brazil', country: 'BR' },
  'AR': { code: 'AR', currency: 'ARS', name: 'Argentina', country: 'AR' },
  'CL': { code: 'CL', currency: 'CLP', name: 'Chile', country: 'CL' },
  'GB': { code: 'GB', currency: 'GBP', name: 'United Kingdom', country: 'GB' },
  'DE': { code: 'DE', currency: 'EUR', name: 'Germany', country: 'DE' },
  'FR': { code: 'FR', currency: 'EUR', name: 'France', country: 'FR' },
  'ES': { code: 'ES', currency: 'EUR', name: 'Spain', country: 'ES' },
  'IT': { code: 'IT', currency: 'EUR', name: 'Italy', country: 'IT' },
  'NL': { code: 'NL', currency: 'EUR', name: 'Netherlands', country: 'NL' },
  'JP': { code: 'JP', currency: 'JPY', name: 'Japan', country: 'JP' },
  'AU': { code: 'AU', currency: 'AUD', name: 'Australia', country: 'AU' },
  'NZ': { code: 'NZ', currency: 'NZD', name: 'New Zealand', country: 'NZ' },
  'SG': { code: 'SG', currency: 'SGD', name: 'Singapore', country: 'SG' },
  'HK': { code: 'HK', currency: 'HKD', name: 'Hong Kong', country: 'HK' },
  'KR': { code: 'KR', currency: 'KRW', name: 'South Korea', country: 'KR' },
  'TW': { code: 'TW', currency: 'TWD', name: 'Taiwan', country: 'TW' },
  'MY': { code: 'MY', currency: 'MYR', name: 'Malaysia', country: 'MY' },
  'ZA': { code: 'ZA', currency: 'ZAR', name: 'South Africa', country: 'ZA' },
  'RU': { code: 'RU', currency: 'RUB', name: 'Russia', country: 'RU' },
  'NO': { code: 'NO', currency: 'NOK', name: 'Norway', country: 'NO' },
  'SE': { code: 'SE', currency: 'SEK', name: 'Sweden', country: 'SE' },
  'DK': { code: 'DK', currency: 'DKK', name: 'Denmark', country: 'DK' },
  'CH': { code: 'CH', currency: 'CHF', name: 'Switzerland', country: 'CH' }
};

async function searchGame(gameName) {
  console.log(`Searching for game: ${gameName}`);
  
  // Try multiple data sources
  let prices = [];
  
  // Method 1: Try Nintendo's unofficial API
  try {
    prices = await searchViaNintendoAPI(gameName);
    if (prices.length > 0) {
      console.log(`Found ${prices.length} prices via Nintendo API`);
    }
  } catch (error) {
    console.log('Nintendo API failed:', error.message);
  }
  
  // Method 2: Try eshop-prices.com as fallback
  if (prices.length === 0) {
    try {
      prices = await searchViaEshopPrices(gameName);
      console.log(`Found ${prices.length} prices via eshop-prices.com`);
    } catch (error) {
      console.log('eshop-prices.com failed:', error.message);
    }
  }
  
  // Method 3: Try dekudeals.com as final fallback
  if (prices.length === 0) {
    try {
      prices = await searchViaDekuDeals(gameName);
      console.log(`Found ${prices.length} prices via dekudeals.com`);
    } catch (error) {
      console.log('dekudeals.com failed:', error.message);
    }
  }
  
  // Sort by SGD price and return top 25
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

async function searchViaNintendoAPI(gameName) {
  // This uses a more direct approach to Nintendo's search
  const searchUrl = `https://searching.nintendo-europe.com/en/select?q=${encodeURIComponent(gameName)}&fq=type:GAME&rows=10`;
  
  try {
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    const games = response.data?.response?.docs || [];
    if (games.length === 0) return [];
    
    // Get the first matching game
    const game = games[0];
    const nsuid = game.nsuid_txt?.[0];
    
    if (!nsuid) return [];
    
    // Get prices for this game across regions
    return await getPricesForGame(nsuid, game.title);
    
  } catch (error) {
    console.log('Nintendo search API error:', error.message);
    return [];
  }
}

async function getPricesForGame(nsuid, gameTitle) {
  const prices = [];
  
  // Nintendo's price API for different regions
  const priceEndpoints = [
    { region: 'US', url: `https://api.ec.nintendo.com/v1/price?country=US&lang=en&ids=${nsuid}` },
    { region: 'EU', url: `https://api.ec.nintendo.com/v1/price?country=GB&lang=en&ids=${nsuid}` },
    { region: 'JP', url: `https://api.ec.nintendo.com/v1/price?country=JP&lang=ja&ids=${nsuid}` }
  ];
  
  for (const endpoint of priceEndpoints) {
    try {
      const response = await axios.get(endpoint.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 5000
      });
      
      const priceData = response.data?.prices?.[0];
      if (priceData && priceData.regular_price) {
        const regionInfo = Object.values(REGIONS).find(r => r.code === endpoint.region);
        if (regionInfo) {
          const price = priceData.regular_price.amount / 100; // Convert from cents
          const sgdPrice = await convertToSGD(price, regionInfo.currency);
          
          prices.push({
            region: regionInfo.name,
            regionCode: endpoint.region,
            originalPrice: price,
            currency: regionInfo.currency,
            sgdPrice: sgdPrice,
            title: gameTitle,
            discount: priceData.discount_price ? Math.round((1 - priceData.discount_price.amount / priceData.regular_price.amount) * 100) : 0
          });
        }
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.log(`Price API error for ${endpoint.region}:`, error.message);
    }
  }
  
  return prices;
}

async function searchViaEshopPrices(gameName) {
  try {
    const searchUrl = `https://eshop-prices.com/games?q=${encodeURIComponent(gameName)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 15000
    });
    
    // This would need to parse the HTML response from eshop-prices.com
    // For now, return empty array as it requires more complex parsing
    return [];
    
  } catch (error) {
    console.log('eshop-prices.com error:', error.message);
    return [];
  }
}

async function searchViaDekuDeals(gameName) {
  try {
    // DekuDeals has an API that's more accessible
    const searchUrl = `https://www.dekudeals.com/api/search?q=${encodeURIComponent(gameName)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    // Parse DekuDeals response and extract price data
    // This would need implementation based on their API structure
    return [];
    
  } catch (error) {
    console.log('DekuDeals error:', error.message);
    return [];
  }
}

module.exports = { searchGame, REGIONS };