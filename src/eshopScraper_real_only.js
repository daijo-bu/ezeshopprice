const axios = require('axios');
const { convertToSGD } = require('./currencyConverter');

// Enhanced region data with purchase difficulty and gift card availability
const REGIONS = {
  'US': { code: 'US', currency: 'USD', name: 'United States', difficult: false, giftCards: true },
  'CA': { code: 'CA', currency: 'CAD', name: 'Canada', difficult: false, giftCards: true },
  'MX': { code: 'MX', currency: 'MXN', name: 'Mexico', difficult: true, giftCards: true },
  'BR': { code: 'BR', currency: 'BRL', name: 'Brazil', difficult: true, giftCards: true },
  'AR': { code: 'AR', currency: 'ARS', name: 'Argentina', difficult: true, giftCards: true },
  'CL': { code: 'CL', currency: 'CLP', name: 'Chile', difficult: true, giftCards: false },
  'GB': { code: 'GB', currency: 'GBP', name: 'United Kingdom', difficult: false, giftCards: true },
  'DE': { code: 'DE', currency: 'EUR', name: 'Germany', difficult: false, giftCards: true },
  'FR': { code: 'FR', currency: 'EUR', name: 'France', difficult: false, giftCards: true },
  'ES': { code: 'ES', currency: 'EUR', name: 'Spain', difficult: false, giftCards: true },
  'IT': { code: 'IT', currency: 'EUR', name: 'Italy', difficult: false, giftCards: true },
  'NL': { code: 'NL', currency: 'EUR', name: 'Netherlands', difficult: false, giftCards: true },
  'BE': { code: 'BE', currency: 'EUR', name: 'Belgium', difficult: false, giftCards: false },
  'AT': { code: 'AT', currency: 'EUR', name: 'Austria', difficult: false, giftCards: false },
  'CH': { code: 'CH', currency: 'CHF', name: 'Switzerland', difficult: true, giftCards: false },
  'NO': { code: 'NO', currency: 'NOK', name: 'Norway', difficult: true, giftCards: false },
  'SE': { code: 'SE', currency: 'SEK', name: 'Sweden', difficult: false, giftCards: false },
  'DK': { code: 'DK', currency: 'DKK', name: 'Denmark', difficult: false, giftCards: false },
  'JP': { code: 'JP', currency: 'JPY', name: 'Japan', difficult: true, giftCards: true },
  'AU': { code: 'AU', currency: 'AUD', name: 'Australia', difficult: false, giftCards: true },
  'NZ': { code: 'NZ', currency: 'NZD', name: 'New Zealand', difficult: false, giftCards: false },
  'SG': { code: 'SG', currency: 'SGD', name: 'Singapore', difficult: false, giftCards: false },
  'HK': { code: 'HK', currency: 'HKD', name: 'Hong Kong', difficult: true, giftCards: true },
  'KR': { code: 'KR', currency: 'KRW', name: 'South Korea', difficult: true, giftCards: false },
  'TW': { code: 'TW', currency: 'TWD', name: 'Taiwan', difficult: true, giftCards: false },
  'MY': { code: 'MY', currency: 'MYR', name: 'Malaysia', difficult: true, giftCards: false },
  'TH': { code: 'TH', currency: 'THB', name: 'Thailand', difficult: true, giftCards: false },
  'RU': { code: 'RU', currency: 'RUB', name: 'Russia', difficult: true, giftCards: true },
  'ZA': { code: 'ZA', currency: 'ZAR', name: 'South Africa', difficult: true, giftCards: true }
};

async function searchGames(gameName) {
  console.log(`[REAL] Searching for games matching: ${gameName}`);
  
  try {
    const games = await searchNintendoEurope(gameName);
    
    if (games.length === 0) {
      return { type: 'no_results', message: `No games found for "${gameName}". Try a different search term or check spelling.` };
    }
    
    if (games.length === 1) {
      console.log(`[REAL] Single match found: ${games[0].title}`);
      const prices = await getPricesForGame(games[0]);
      
      if (prices.length === 0) {
        return { 
          type: 'no_prices', 
          game: games[0],
          message: `Found "${games[0].title}" but no pricing data is available. This game may not be released yet or may not be available in the regions we monitor.` 
        };
      }
      
      return { 
        type: 'prices', 
        game: games[0],
        prices: prices 
      };
    }
    
    // Multiple matches - return options for user to choose
    console.log(`[REAL] Multiple matches found: ${games.length} games`);
    return { 
      type: 'multiple_options', 
      games: games.slice(0, 5), // Limit to top 5 matches
      message: `Found ${games.length} games matching "${gameName}". Please select which game you want:` 
    };
    
  } catch (error) {
    console.error(`[REAL] Search error: ${error.message}`);
    return { 
      type: 'error', 
      message: 'Sorry, there was an error searching for games. Please try again later.' 
    };
  }
}

async function searchGameByNSUID(nsuid) {
  console.log(`[REAL] Getting prices for NSUID: ${nsuid}`);
  
  try {
    // Find the game details first
    const gameDetails = await getGameDetailsByNSUID(nsuid);
    if (!gameDetails) {
      return { type: 'error', message: 'Game not found.' };
    }
    
    const prices = await getPricesForGame(gameDetails);
    
    if (prices.length === 0) {
      return { 
        type: 'no_prices', 
        game: gameDetails,
        message: `Found "${gameDetails.title}" but no pricing data is available.` 
      };
    }
    
    return { 
      type: 'prices', 
      game: gameDetails,
      prices: prices 
    };
    
  } catch (error) {
    console.error(`[REAL] NSUID search error: ${error.message}`);
    return { 
      type: 'error', 
      message: 'Sorry, there was an error getting game prices.' 
    };
  }
}

async function searchNintendoEurope(gameName) {
  const searchUrl = `https://searching.nintendo-europe.com/en/select`;
  
  try {
    const response = await axios.get(searchUrl, {
      params: {
        q: gameName,
        fq: 'type:GAME AND system_type:nintendoswitch*',
        rows: 10,
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
    
    const searchResults = response.data?.response?.docs || [];
    
    // Score and filter results
    const scoredGames = searchResults
      .filter(game => game.nsuid_txt?.[0]) // Filter out games without NSUID first
      .map(game => ({
        game,
        score: calculateMatchScore(gameName, game)
      }))
      .filter(item => item.score > 20) // Only keep reasonable matches
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        title: item.game.title,
        nsuid: item.game.nsuid_txt[0],
        developer: item.game.developer,
        publisher: item.game.publisher,
        image: item.game.image_url,
        releaseDate: item.game.date_from,
        score: item.score
      }));
    
    console.log(`[REAL] Found ${scoredGames.length} valid matches`);
    scoredGames.forEach((game, index) => {
      console.log(`[REAL] ${index + 1}. "${game.title}" (score: ${game.score})`);
    });
    
    return scoredGames;
    
  } catch (error) {
    console.error(`[REAL] Nintendo Europe search error: ${error.message}`);
    throw error;
  }
}

function calculateMatchScore(searchTerm, game) {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const title = (game.title || '').toLowerCase();
  let score = 0;
  
  // Exact match gets highest score
  if (title === normalizedSearch) {
    return 1000;
  }
  
  // Title starts with search term
  if (title.startsWith(normalizedSearch)) {
    score += 800;
  }
  
  // Title contains search term
  if (title.includes(normalizedSearch)) {
    score += 500;
  }
  
  // Search term contains title (for shorter titles)
  if (normalizedSearch.includes(title)) {
    score += 300;
  }
  
  // Enhanced word-by-word matching
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 1);
  const titleWords = title.split(' ').filter(w => w.length > 1);
  
  let exactWordMatches = 0;
  let partialWordMatches = 0;
  
  searchWords.forEach(searchWord => {
    titleWords.forEach(titleWord => {
      if (searchWord === titleWord) {
        exactWordMatches++;
        score += 150; // Higher score for exact word matches
      } else if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        partialWordMatches++;
        score += 75; // Lower score for partial matches
      }
    });
  });
  
  // Special handling for common game series
  const gameSeriesBonus = getGameSeriesBonus(normalizedSearch, title);
  score += gameSeriesBonus;
  
  // Bonus for matching most search words exactly
  if (exactWordMatches >= Math.max(1, searchWords.length - 1)) {
    score += 300;
  }
  
  // Bonus for matching all search words (exact or partial)
  if (exactWordMatches + partialWordMatches >= searchWords.length && searchWords.length > 1) {
    score += 150;
  }
  
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
}

function getGameSeriesBonus(searchTerm, title) {
  const commonSeries = [
    { search: ['mario', 'kart'], title: ['mario', 'kart'], bonus: 200 },
    { search: ['zelda'], title: ['zelda'], bonus: 200 },
    { search: ['pokemon'], title: ['pokémon'], bonus: 200 },
    { search: ['pokemon'], title: ['pokemon'], bonus: 200 },
    { search: ['smash', 'bros'], title: ['smash'], bonus: 200 },
    { search: ['metroid'], title: ['metroid'], bonus: 200 },
    { search: ['splatoon'], title: ['splatoon'], bonus: 200 }
  ];
  
  for (const series of commonSeries) {
    const searchMatches = series.search.every(word => searchTerm.includes(word));
    const titleMatches = series.title.some(word => title.includes(word));
    
    if (searchMatches && titleMatches) {
      return series.bonus;
    }
  }
  
  return 0;
}

async function getGameDetailsByNSUID(nsuid) {
  // For now, return basic details. In a full implementation, 
  // you'd fetch from Nintendo's API or cache
  return {
    title: 'Selected Game',
    nsuid: nsuid,
    developer: 'Unknown',
    publisher: 'Unknown'
  };
}

async function getPricesForGame(game) {
  console.log(`[REAL] Fetching real prices for: ${game.title}`);
  
  const prices = [];
  const pricePromises = Object.entries(REGIONS).map(([regionCode, region]) =>
    fetchRealPriceForRegion(game, region, regionCode)
  );
  
  const results = await Promise.allSettled(pricePromises);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      prices.push(result.value);
    } else if (result.status === 'rejected') {
      const regionCode = Object.keys(REGIONS)[index];
      console.log(`[REAL] Failed to get price for ${regionCode}: ${result.reason?.message || 'Unknown error'}`);
    }
  });
  
  console.log(`[REAL] Successfully retrieved ${prices.length} real prices for ${game.title}`);
  
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

async function fetchRealPriceForRegion(game, region, regionCode) {
  if (!game.nsuid) {
    return null;
  }
  
  // Add delay to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  try {
    const priceData = await fetchNintendoPriceAPI(game.nsuid, region);
    
    if (priceData && priceData.price > 0) {
      const sgdPrice = await convertToSGD(priceData.price, region.currency);
      
      if (sgdPrice > 0) {
        return {
          region: region.name,
          regionCode: regionCode,
          originalPrice: priceData.price,
          currency: region.currency,
          sgdPrice: sgdPrice,
          title: game.title,
          discount: priceData.discount || 0,
          difficult: region.difficult,
          giftCards: region.giftCards
        };
      }
    }
    
  } catch (error) {
    console.log(`[REAL] Price fetch error for ${regionCode}: ${error.message}`);
  }
  
  return null;
}

async function fetchNintendoPriceAPI(nsuid, region) {
  if (!nsuid) return null;
  
  try {
    const response = await axios.get('https://api.ec.nintendo.com/v1/price', {
      params: {
        country: region.code,
        lang: 'en',
        ids: nsuid
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 8000
    });
    
    const priceInfo = response.data?.prices?.[0];
    if (!priceInfo || !priceInfo.regular_price || !priceInfo.regular_price.amount) {
      return null;
    }
    
    const regularPrice = priceInfo.regular_price.amount;
    const discountPrice = priceInfo.discount_price?.amount;
    
    if (!regularPrice || isNaN(regularPrice) || regularPrice <= 0) {
      return null;
    }
    
    const price = discountPrice || regularPrice;
    const discount = discountPrice ? 
      Math.round((1 - discountPrice / regularPrice) * 100) : 0;
    
    const finalPrice = price / 100; // Convert from cents
    
    if (isNaN(finalPrice) || finalPrice <= 0) {
      return null;
    }
    
    return {
      price: finalPrice,
      discount: discount
    };
    
  } catch (error) {
    return null;
  }
}

module.exports = { searchGames, searchGameByNSUID, REGIONS };