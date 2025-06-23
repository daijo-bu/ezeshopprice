const axios = require('axios');

const EXCHANGE_RATES_CACHE = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function getExchangeRates() {
  const cacheKey = 'exchange_rates';
  const cached = EXCHANGE_RATES_CACHE.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/SGD', {
      timeout: 5000
    });
    
    const rates = {};
    for (const [currency, rate] of Object.entries(response.data.rates)) {
      rates[currency] = 1 / rate; // Convert from SGD to other currencies
    }
    rates['SGD'] = 1; // SGD to SGD is 1
    
    EXCHANGE_RATES_CACHE.set(cacheKey, {
      data: rates,
      timestamp: Date.now()
    });
    
    return rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error.message);
    
    // Fallback to hardcoded rates if API fails
    return getFallbackRates();
  }
}

function getFallbackRates() {
  return {
    'USD': 0.74,
    'EUR': 0.69,
    'GBP': 0.59,
    'JPY': 110.0,
    'CAD': 1.01,
    'AUD': 1.07,
    'CHF': 0.67,
    'CNY': 5.26,
    'HKD': 5.78,
    'NZD': 1.17,
    'SEK': 7.98,
    'NOK': 7.85,
    'DKK': 5.13,
    'PLN': 3.11,
    'CZK': 17.2,
    'HUF': 276.0,
    'RUB': 73.5,
    'BRL': 3.95,
    'MXN': 17.8,
    'KRW': 960.0,
    'TWD': 22.8,
    'THB': 26.5,
    'MYR': 3.42,
    'SGD': 1.0,
    'ZAR': 13.8,
    'ARS': 365.0,
    'CLP': 890.0,
    'COP': 4200.0,
    'PEN': 3.75
  };
}

async function convertToSGD(amount, fromCurrency) {
  if (fromCurrency === 'SGD') {
    return amount;
  }
  
  try {
    const rates = await getExchangeRates();
    const rate = rates[fromCurrency];
    
    if (!rate) {
      console.warn(`No exchange rate found for ${fromCurrency}, using fallback`);
      const fallbackRates = getFallbackRates();
      return amount * (fallbackRates[fromCurrency] || 1);
    }
    
    return amount * rate;
  } catch (error) {
    console.error(`Error converting ${fromCurrency} to SGD:`, error.message);
    return amount; // Return original amount if conversion fails
  }
}

module.exports = { convertToSGD, getExchangeRates };