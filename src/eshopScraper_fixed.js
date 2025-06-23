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
  console.log(`[FIXED] Searching for games matching: ${gameName}`);
  
  try {
    const games = await searchNintendoEurope(gameName);
    
    if (games.length === 0) {
      return { type: 'no_results', message: `No games found for "${gameName}". Try a different search term or check spelling.` };
    }
    
    // Check if we have a single clear winner (score significantly higher than others)
    if (games.length === 1 || (games.length > 1 && games[0].score > games[1].score * 1.5)) {
      console.log(`[FIXED] Clear winner found: ${games[0].title} (score: ${games[0].score})`);
      const prices = await getPricesForGame(games[0]);
      
      if (prices.length === 0) {
        return { 
          type: 'no_prices', 
          game: games[0],
          message: `Found "${games[0].title}" but no real pricing data is available. This game may not be released yet or may not be available in the monitored regions.` 
        };
      }
      
      return { 
        type: 'prices', 
        game: games[0],
        prices: prices 
      };
    }
    
    // Multiple matches - return options for user to choose
    console.log(`[FIXED] Multiple matches found: ${games.length} games`);
    return { 
      type: 'multiple_options', 
      games: games.slice(0, 5), // Limit to top 5 matches
      message: `Found ${games.length} games matching "${gameName}". Please select which game you want:` 
    };
    
  } catch (error) {
    console.error(`[FIXED] Search error: ${error.message}`);
    return { 
      type: 'error', 
      message: 'Sorry, there was an error searching for games. Please try again later.' 
    };
  }
}

async function searchGameByNSUID(nsuid) {
  console.log(`[FIXED] Getting prices for NSUID: ${nsuid}`);
  
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
        message: `Found "${gameDetails.title}" but no real pricing data is available.` 
      };
    }
    
    return { 
      type: 'prices', 
      game: gameDetails,
      prices: prices 
    };
    
  } catch (error) {
    console.error(`[FIXED] NSUID search error: ${error.message}`);
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
        rows: 50, // Increased from 10 to 50 to catch more games
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
      .filter(item => item.score > 50) // Increased threshold from 20 to 50 for better matches
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
    
    console.log(`[FIXED] Found ${scoredGames.length} valid matches`);
    scoredGames.forEach((game, index) => {
      console.log(`[FIXED] ${index + 1}. "${game.title}" (score: ${game.score})`);
    });
    
    return scoredGames;
    
  } catch (error) {
    console.error(`[FIXED] Nintendo Europe search error: ${error.message}`);
    throw error;
  }
}

function calculateMatchScore(searchTerm, game) {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const title = (game.title || '').toLowerCase();
  let score = 0;
  
  // Exact match gets highest score
  if (title === normalizedSearch) {
    return 2000;
  }
  
  // Title starts with search term (very high priority)
  if (title.startsWith(normalizedSearch)) {
    score += 1500;
  }
  
  // Title contains search term exactly
  if (title.includes(normalizedSearch)) {
    score += 1000;
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
        score += 200; // Increased from 150
      } else if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        partialWordMatches++;
        score += 100; // Increased from 75
      }
    });
  });
  
  // Special handling for common game series (higher bonuses)
  const gameSeriesBonus = getGameSeriesBonus(normalizedSearch, title);
  score += gameSeriesBonus;
  
  // Major bonus for matching ALL search words exactly
  if (exactWordMatches >= searchWords.length && searchWords.length > 1) {
    score += 800; // Big bonus for exact matches
  }
  
  // Bonus for matching most search words exactly
  if (exactWordMatches >= Math.max(1, searchWords.length - 1)) {
    score += 400;
  }
  
  // Bonus for matching all search words (exact or partial)
  if (exactWordMatches + partialWordMatches >= searchWords.length && searchWords.length > 1) {
    score += 200;
  }
  
  // First-party Nintendo games get boost
  const publisher = (game.publisher || '').toLowerCase();
  if (publisher.includes('nintendo')) {
    score += 50; // Increased from 25
  }
  
  return score;
}

function getGameSeriesBonus(searchTerm, title) {
  const commonSeries = [
    { search: ['mario', 'kart'], title: ['mario', 'kart'], bonus: 500 }, // Increased from 200
    { search: ['zelda'], title: ['zelda'], bonus: 400 },
    { search: ['pokemon'], title: ['pokémon'], bonus: 400 },
    { search: ['pokemon'], title: ['pokemon'], bonus: 400 },
    { search: ['smash', 'bros'], title: ['smash'], bonus: 400 },
    { search: ['metroid'], title: ['metroid'], bonus: 400 },
    { search: ['splatoon'], title: ['splatoon'], bonus: 400 }
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
  console.log(`[FIXED] Fetching real prices for: ${game.title}`);
  
  const prices = [];
  
  // Test with a subset of major regions first to see if the API works
  const testRegions = [
    ['US', REGIONS.US],
    ['GB', REGIONS.GB], 
    ['DE', REGIONS.DE],
    ['JP', REGIONS.JP],
    ['AU', REGIONS.AU]
  ];
  
  console.log(`[FIXED] Testing price API with ${testRegions.length} major regions...`);
  
  for (const [regionCode, region] of testRegions) {
    try {
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limiting
      
      const priceData = await fetchNintendoPriceAPI(game.nsuid, region, regionCode);
      
      if (priceData && priceData.price > 0) {
        const sgdPrice = await convertToSGD(priceData.price, region.currency);
        
        if (sgdPrice > 0) {
          prices.push({
            region: region.name,
            regionCode: regionCode,
            originalPrice: priceData.price,
            currency: region.currency,
            sgdPrice: sgdPrice,
            title: game.title,
            discount: priceData.discount || 0,
            difficult: region.difficult,
            giftCards: region.giftCards
          });
          
          console.log(`[FIXED] ✅ Got real price for ${regionCode}: ${priceData.price} ${region.currency} = S$${sgdPrice.toFixed(2)}`);
        }
      } else {
        console.log(`[FIXED] ❌ No price data for ${regionCode}`);
      }
      
    } catch (error) {
      console.log(`[FIXED] ❌ Error fetching ${regionCode}: ${error.message}`);
    }
  }
  
  // If we got some real prices, try to get more from all regions
  if (prices.length > 0) {
    console.log(`[FIXED] Got ${prices.length} test prices, fetching from all regions...`);
    
    const remainingRegions = Object.entries(REGIONS).filter(([code]) => 
      !testRegions.find(([testCode]) => testCode === code)
    );
    
    const remainingPromises = remainingRegions.map(([regionCode, region]) =>
      fetchPriceForRegion(game, region, regionCode)
    );
    
    const remainingResults = await Promise.allSettled(remainingPromises);
    
    remainingResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    });
  }
  
  console.log(`[FIXED] Total real prices found: ${prices.length}`);
  
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

async function fetchPriceForRegion(game, region, regionCode) {
  try {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const priceData = await fetchNintendoPriceAPI(game.nsuid, region, regionCode);
    
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
    // Silently fail for individual regions
  }
  
  return null;
}

async function fetchNintendoPriceAPI(nsuid, region, regionCode) {
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
    
    // Check if the game is available in this region
    if (!priceInfo || priceInfo.sales_status !== 'onsale') {
      console.log(`[FIXED] Game not available in ${regionCode}: ${priceInfo?.sales_status || 'no data'}`);
      return null;
    }
    
    // Extract price from the new API format
    const regularPriceData = priceInfo.regular_price;
    const discountPriceData = priceInfo.discount_price;
    
    if (!regularPriceData || !regularPriceData.raw_value) {
      console.log(`[FIXED] No price data for ${regionCode}`);
      return null;
    }
    
    const regularPrice = parseFloat(regularPriceData.raw_value);
    const discountPrice = discountPriceData ? parseFloat(discountPriceData.raw_value) : null;
    
    if (isNaN(regularPrice) || regularPrice <= 0) {
      console.log(`[FIXED] Invalid price for ${regionCode}: ${regularPriceData.raw_value}`);
      return null;
    }
    
    const finalPrice = discountPrice || regularPrice;
    const discount = discountPrice ? 
      Math.round((1 - discountPrice / regularPrice) * 100) : 0;
    
    console.log(`[FIXED] ✅ Valid price for ${regionCode}: ${finalPrice} ${region.currency}`);
    
    return {
      price: finalPrice,
      discount: discount
    };
    
  } catch (error) {
    console.log(`[FIXED] API error for ${regionCode}: ${error.message}`);
    return null;
  }
}

module.exports = { searchGames, searchGameByNSUID, REGIONS };