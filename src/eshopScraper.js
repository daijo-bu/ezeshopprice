const axios = require('axios');
const cheerio = require('cheerio');
const { convertToSGD } = require('./currencyConverter');

const REGIONS = {
  'US': { code: 'US', currency: 'USD', name: 'United States' },
  'CA': { code: 'CA', currency: 'CAD', name: 'Canada' },
  'MX': { code: 'MX', currency: 'MXN', name: 'Mexico' },
  'BR': { code: 'BR', currency: 'BRL', name: 'Brazil' },
  'AR': { code: 'AR', currency: 'ARS', name: 'Argentina' },
  'CL': { code: 'CL', currency: 'CLP', name: 'Chile' },
  'PE': { code: 'PE', currency: 'PEN', name: 'Peru' },
  'CO': { code: 'CO', currency: 'COP', name: 'Colombia' },
  'GB': { code: 'GB', currency: 'GBP', name: 'United Kingdom' },
  'DE': { code: 'DE', currency: 'EUR', name: 'Germany' },
  'FR': { code: 'FR', currency: 'EUR', name: 'France' },
  'ES': { code: 'ES', currency: 'EUR', name: 'Spain' },
  'IT': { code: 'IT', currency: 'EUR', name: 'Italy' },
  'NL': { code: 'NL', currency: 'EUR', name: 'Netherlands' },
  'BE': { code: 'BE', currency: 'EUR', name: 'Belgium' },
  'AT': { code: 'AT', currency: 'EUR', name: 'Austria' },
  'CH': { code: 'CH', currency: 'CHF', name: 'Switzerland' },
  'NO': { code: 'NO', currency: 'NOK', name: 'Norway' },
  'SE': { code: 'SE', currency: 'SEK', name: 'Sweden' },
  'DK': { code: 'DK', currency: 'DKK', name: 'Denmark' },
  'PL': { code: 'PL', currency: 'PLN', name: 'Poland' },
  'CZ': { code: 'CZ', currency: 'CZK', name: 'Czech Republic' },
  'HU': { code: 'HU', currency: 'HUF', name: 'Hungary' },
  'JP': { code: 'JP', currency: 'JPY', name: 'Japan' },
  'KR': { code: 'KR', currency: 'KRW', name: 'South Korea' },
  'HK': { code: 'HK', currency: 'HKD', name: 'Hong Kong' },
  'TW': { code: 'TW', currency: 'TWD', name: 'Taiwan' },
  'SG': { code: 'SG', currency: 'SGD', name: 'Singapore' },
  'MY': { code: 'MY', currency: 'MYR', name: 'Malaysia' },
  'TH': { code: 'TH', currency: 'THB', name: 'Thailand' },
  'AU': { code: 'AU', currency: 'AUD', name: 'Australia' },
  'NZ': { code: 'NZ', currency: 'NZD', name: 'New Zealand' },
  'RU': { code: 'RU', currency: 'RUB', name: 'Russia' },
  'ZA': { code: 'ZA', currency: 'ZAR', name: 'South Africa' }
};

async function searchGame(gameName) {
  const prices = [];
  
  for (const [regionCode, region] of Object.entries(REGIONS)) {
    try {
      const gameData = await scrapeRegionPrice(gameName, region);
      if (gameData) {
        const sgdPrice = await convertToSGD(gameData.price, region.currency);
        prices.push({
          region: region.name,
          regionCode: regionCode,
          originalPrice: gameData.price,
          currency: region.currency,
          sgdPrice: sgdPrice,
          title: gameData.title,
          discount: gameData.discount || 0
        });
      }
    } catch (error) {
      console.error(`Error scraping ${region.name}:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

async function scrapeRegionPrice(gameName, region) {
  try {
    const searchUrl = `https://www.nintendo.com/${region.code.toLowerCase()}/search/?q=${encodeURIComponent(gameName)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    const gameElement = $('.game-tile').first();
    if (gameElement.length === 0) {
      return null;
    }
    
    const title = gameElement.find('.game-tile__name').text().trim();
    const priceText = gameElement.find('.price').text().trim();
    
    if (!priceText) {
      return null;
    }
    
    const priceMatch = priceText.match(/[\d.,]+/);
    if (!priceMatch) {
      return null;
    }
    
    const price = parseFloat(priceMatch[0].replace(/,/g, ''));
    
    const discountElement = gameElement.find('.discount');
    const discount = discountElement.length > 0 ? 
      parseInt(discountElement.text().replace(/[^\d]/g, '')) : 0;
    
    return {
      title,
      price,
      discount
    };
    
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.response?.status === 404) {
      return await scrapeAlternativeSource(gameName, region);
    }
    throw error;
  }
}

async function scrapeAlternativeSource(gameName, region) {
  try {
    const eshopPricesUrl = `https://eshop-prices.com/games?q=${encodeURIComponent(gameName)}&currency=${region.currency}`;
    
    const response = await axios.get(eshopPricesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    const gameCard = $('.game-collection-item').first();
    if (gameCard.length === 0) {
      return null;
    }
    
    const title = gameCard.find('.game-collection-item-details h5').text().trim();
    const priceElement = gameCard.find(`.price-${region.code.toLowerCase()}`);
    
    if (priceElement.length === 0) {
      return null;
    }
    
    const priceText = priceElement.text().trim();
    const priceMatch = priceText.match(/[\d.,]+/);
    
    if (!priceMatch) {
      return null;
    }
    
    const price = parseFloat(priceMatch[0].replace(/,/g, ''));
    
    return {
      title,
      price,
      discount: 0
    };
    
  } catch (error) {
    return null;
  }
}

module.exports = { searchGame, REGIONS };