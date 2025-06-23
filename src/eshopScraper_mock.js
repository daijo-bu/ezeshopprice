const { convertToSGD } = require('./currencyConverter');

const REGIONS = {
  'US': { code: 'US', currency: 'USD', name: 'United States' },
  'CA': { code: 'CA', currency: 'CAD', name: 'Canada' },
  'MX': { code: 'MX', currency: 'MXN', name: 'Mexico' },
  'BR': { code: 'BR', currency: 'BRL', name: 'Brazil' },
  'GB': { code: 'GB', currency: 'GBP', name: 'United Kingdom' },
  'DE': { code: 'DE', currency: 'EUR', name: 'Germany' },
  'FR': { code: 'FR', currency: 'EUR', name: 'France' },
  'JP': { code: 'JP', currency: 'JPY', name: 'Japan' },
  'AU': { code: 'AU', currency: 'AUD', name: 'Australia' },
  'SG': { code: 'SG', currency: 'SGD', name: 'Singapore' },
  'HK': { code: 'HK', currency: 'HKD', name: 'Hong Kong' },
  'KR': { code: 'KR', currency: 'KRW', name: 'South Korea' },
  'MY': { code: 'MY', currency: 'MYR', name: 'Malaysia' },
  'ZA': { code: 'ZA', currency: 'ZAR', name: 'South Africa' },
  'RU': { code: 'RU', currency: 'RUB', name: 'Russia' },
  'NO': { code: 'NO', currency: 'NOK', name: 'Norway' },
  'CH': { code: 'CH', currency: 'CHF', name: 'Switzerland' }
};

// Mock game database with realistic prices
const MOCK_GAMES = {
  'mario kart': {
    title: 'Mario Kart 8 Deluxe',
    prices: {
      'RU': 45.99, 'ZA': 52.00, 'BR': 48.50, 'MX': 55.99,
      'MY': 58.90, 'KR': 59000, 'HK': 468, 'NO': 599,
      'CH': 69.90, 'CA': 79.99, 'AU': 79.95, 'GB': 49.99,
      'DE': 59.99, 'FR': 59.99, 'JP': 6578, 'SG': 79.90,
      'US': 59.99
    }
  },
  'zelda': {
    title: 'The Legend of Zelda: Breath of the Wild',
    prices: {
      'RU': 52.99, 'ZA': 58.00, 'BR': 54.50, 'MX': 62.99,
      'MY': 65.90, 'KR': 66000, 'HK': 518, 'NO': 659,
      'CH': 76.90, 'CA': 89.99, 'AU': 89.95, 'GB': 54.99,
      'DE': 69.99, 'FR': 69.99, 'JP': 7678, 'SG': 89.90,
      'US': 59.99
    }
  },
  'pokemon': {
    title: 'Pokémon Scarlet/Violet',
    prices: {
      'RU': 48.99, 'ZA': 55.00, 'BR': 51.50, 'MX': 58.99,
      'MY': 62.90, 'KR': 63000, 'HK': 488, 'NO': 629,
      'CH': 72.90, 'CA': 84.99, 'AU': 84.95, 'GB': 52.99,
      'DE': 64.99, 'FR': 64.99, 'JP': 6578, 'SG': 84.90,
      'US': 59.99
    }
  },
  'mario': {
    title: 'Super Mario Odyssey',
    prices: {
      'RU': 42.99, 'ZA': 49.00, 'BR': 45.50, 'MX': 52.99,
      'MY': 55.90, 'KR': 56000, 'HK': 438, 'NO': 569,
      'CH': 66.90, 'CA': 74.99, 'AU': 74.95, 'GB': 46.99,
      'DE': 56.99, 'FR': 56.99, 'JP': 5478, 'SG': 74.90,
      'US': 49.99
    }
  },
  'smash': {
    title: 'Super Smash Bros. Ultimate',
    prices: {
      'RU': 49.99, 'ZA': 56.00, 'BR': 52.50, 'MX': 59.99,
      'MY': 63.90, 'KR': 64000, 'HK': 498, 'NO': 639,
      'CH': 73.90, 'CA': 84.99, 'AU': 84.95, 'GB': 53.99,
      'DE': 64.99, 'FR': 64.99, 'JP': 6578, 'SG': 84.90,
      'US': 59.99
    }
  }
};

async function searchGame(gameName) {
  console.log(`[MOCK] Searching for game: ${gameName}`);
  
  // Simulate search delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Find matching game (case insensitive, partial match)
  const searchKey = gameName.toLowerCase();
  const gameKey = Object.keys(MOCK_GAMES).find(key => 
    searchKey.includes(key) || key.includes(searchKey)
  );
  
  if (!gameKey) {
    console.log(`[MOCK] No game found for: ${gameName}`);
    return [];
  }
  
  const gameData = MOCK_GAMES[gameKey];
  const prices = [];
  
  console.log(`[MOCK] Found game: ${gameData.title}`);
  
  // Convert prices to SGD and create price objects
  for (const [regionCode, price] of Object.entries(gameData.prices)) {
    const region = REGIONS[regionCode];
    if (!region) continue;
    
    try {
      const sgdPrice = await convertToSGD(price, region.currency);
      
      prices.push({
        region: region.name,
        regionCode: regionCode,
        originalPrice: price,
        currency: region.currency,
        sgdPrice: sgdPrice,
        title: gameData.title,
        discount: Math.random() > 0.7 ? Math.floor(Math.random() * 30) + 10 : 0 // Random discounts
      });
      
      // Small delay to simulate API calls
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error) {
      console.log(`[MOCK] Error converting price for ${regionCode}:`, error.message);
    }
  }
  
  console.log(`[MOCK] Generated ${prices.length} prices for ${gameData.title}`);
  
  // Sort by SGD price and return top 25
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

module.exports = { searchGame, REGIONS };