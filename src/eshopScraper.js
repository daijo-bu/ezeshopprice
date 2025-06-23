const { 
  getQueriedGamesAmerica,
  getPrices
} = require('nintendo-switch-eshop');
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
  console.log(`[NINTENDO-LIB] Searching for games matching: ${gameName}`);
  
  try {
    // Use the nintendo-switch-eshop library to search for games
    const games = await getQueriedGamesAmerica(gameName, { hitsPerPage: 50 });
    
    if (games.length === 0) {
      return { type: 'no_results', message: `No games found for "${gameName}". Try a different search term or check spelling.` };
    }
    
    // Score and filter results
    const scoredGames = games
      .filter(game => game.nsuid && game.nsuid !== 'MOBILE') // Filter out mobile games and games without NSUID
      .map(game => ({
        title: game.title,
        nsuid: game.nsuid,
        developer: game.developers?.[0] || 'Unknown',
        publisher: game.publishers?.[0] || 'Unknown',
        image: game.boxart,
        releaseDate: game.releaseDateDisplay,
        score: calculateMatchScore(gameName, game.title)
      }))
      .filter(game => game.score > 30) // Filter for reasonably good matches
      .sort((a, b) => b.score - a.score);
    
    if (scoredGames.length === 0) {
      return { type: 'no_results', message: `No relevant games found for "${gameName}". Try a different search term.` };
    }
    
    console.log(`[NINTENDO-LIB] Found ${scoredGames.length} valid matches`);
    scoredGames.forEach((game, index) => {
      console.log(`[NINTENDO-LIB] ${index + 1}. "${game.title}" (score: ${game.score})`);
    });
    
    // Check if we have a single clear winner
    if (scoredGames.length === 1 || (scoredGames.length > 1 && scoredGames[0].score > scoredGames[1].score * 1.5)) {
      console.log(`[NINTENDO-LIB] Clear winner found: ${scoredGames[0].title} (score: ${scoredGames[0].score})`);
      const prices = await getPricesForGame(scoredGames[0]);
      
      if (prices.length === 0) {
        return { 
          type: 'no_prices', 
          game: scoredGames[0],
          message: `Found "${scoredGames[0].title}" but no real pricing data is available. This game may not be released yet or may not be available in the monitored regions.` 
        };
      }
      
      return { 
        type: 'prices', 
        game: scoredGames[0],
        prices: prices 
      };
    }
    
    // Multiple matches - return options for user to choose
    console.log(`[NINTENDO-LIB] Multiple matches found: ${scoredGames.length} games`);
    return { 
      type: 'multiple_options', 
      games: scoredGames.slice(0, 5), // Limit to top 5 matches
      message: `Found ${scoredGames.length} games matching "${gameName}". Please select which game you want:` 
    };
    
  } catch (error) {
    console.error(`[NINTENDO-LIB] Search error: ${error.message}`);
    
    // Handle specific library errors
    if (error.message.includes('ENOTFOUND')) {
      return { 
        type: 'error', 
        message: 'Network connection issue. Please try again in a moment.' 
      };
    } else if (error.message.includes('timeout')) {
      return { 
        type: 'error', 
        message: 'Search timed out. Please try again with a shorter search term.' 
      };
    } else if (error.message.includes('rate limit')) {
      return { 
        type: 'error', 
        message: 'Too many requests. Please wait a moment before searching again.' 
      };
    } else {
      return { 
        type: 'error', 
        message: 'Sorry, there was an error searching for games. Please try again later.' 
      };
    }
  }
}

async function searchGameByNSUID(nsuid) {
  console.log(`[NINTENDO-LIB] Getting prices for NSUID: ${nsuid}`);
  
  try {
    // Create a game object for the NSUID
    const gameDetails = {
      title: 'Selected Game',
      nsuid: nsuid,
      developer: 'Unknown',
      publisher: 'Unknown'
    };
    
    const prices = await getPricesForGame(gameDetails);
    
    if (prices.length === 0) {
      return { 
        type: 'no_prices', 
        game: gameDetails,
        message: `No real pricing data available for the selected game.` 
      };
    }
    
    // Update game title from price data if available
    if (prices.length > 0) {
      gameDetails.title = prices[0].title || gameDetails.title;
    }
    
    return { 
      type: 'prices', 
      game: gameDetails,
      prices: prices 
    };
    
  } catch (error) {
    console.error(`[NINTENDO-LIB] NSUID search error: ${error.message}`);
    
    // Handle specific library errors
    if (error.message.includes('ENOTFOUND')) {
      return { 
        type: 'error', 
        message: 'Network connection issue. Please try again in a moment.' 
      };
    } else if (error.message.includes('Invalid game NSUID')) {
      return { 
        type: 'error', 
        message: 'Invalid game selected. Please try searching again.' 
      };
    } else {
      return { 
        type: 'error', 
        message: 'Sorry, there was an error getting game prices.' 
      };
    }
  }
}

function calculateMatchScore(searchTerm, gameTitle) {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const title = (gameTitle || '').toLowerCase();
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
  
  // Word-by-word matching
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 1);
  const titleWords = title.split(' ').filter(w => w.length > 1);
  
  let exactWordMatches = 0;
  let partialWordMatches = 0;
  
  searchWords.forEach(searchWord => {
    titleWords.forEach(titleWord => {
      if (searchWord === titleWord) {
        exactWordMatches++;
        score += 200;
      } else if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        partialWordMatches++;
        score += 100;
      }
    });
  });
  
  // Special handling for common game series
  const gameSeriesBonus = getGameSeriesBonus(normalizedSearch, title);
  score += gameSeriesBonus;
  
  // Bonus for matching ALL search words exactly
  if (exactWordMatches >= searchWords.length && searchWords.length > 1) {
    score += 800;
  }
  
  // Bonus for matching most search words exactly
  if (exactWordMatches >= Math.max(1, searchWords.length - 1)) {
    score += 400;
  }
  
  return score;
}

function getGameSeriesBonus(searchTerm, title) {
  const commonSeries = [
    { search: ['mario', 'kart'], title: ['mario', 'kart'], bonus: 500 },
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

async function getPricesForGame(game) {
  console.log(`[NINTENDO-LIB] Fetching real prices for: ${game.title}`);
  
  const prices = [];
  
  // Test with a subset of major regions first
  const testRegions = [
    ['US', REGIONS.US],
    ['GB', REGIONS.GB], 
    ['DE', REGIONS.DE],
    ['JP', REGIONS.JP],
    ['AU', REGIONS.AU]
  ];
  
  console.log(`[NINTENDO-LIB] Testing price API with ${testRegions.length} major regions...`);
  
  for (const [regionCode, region] of testRegions) {
    try {
      await new Promise(resolve => setTimeout(resolve, 300)); // Rate limiting
      
      const priceData = await fetchPriceWithLibrary(game.nsuid, regionCode);
      
      if (priceData && priceData.price > 0) {
        const sgdPrice = await convertToSGD(priceData.price, region.currency);
        
        if (sgdPrice > 0) {
          prices.push({
            region: region.name,
            regionCode: regionCode,
            originalPrice: priceData.price,
            currency: region.currency,
            sgdPrice: sgdPrice,
            title: priceData.title || game.title,
            discount: priceData.discount || 0,
            difficult: region.difficult,
            giftCards: region.giftCards
          });
          
          console.log(`[NINTENDO-LIB] ✅ Got real price for ${regionCode}: ${priceData.price} ${region.currency} = S$${sgdPrice.toFixed(2)}`);
        }
      } else {
        console.log(`[NINTENDO-LIB] ❌ No price data for ${regionCode}`);
      }
      
    } catch (error) {
      console.log(`[NINTENDO-LIB] ❌ Error fetching ${regionCode}: ${error.message}`);
    }
  }
  
  // If we got some real prices, try to get more from all regions
  if (prices.length > 0) {
    console.log(`[NINTENDO-LIB] Got ${prices.length} test prices, fetching from all regions...`);
    
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
  
  console.log(`[NINTENDO-LIB] Total real prices found: ${prices.length}`);
  
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

async function fetchPriceForRegion(game, region, regionCode) {
  try {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const priceData = await fetchPriceWithLibrary(game.nsuid, regionCode);
    
    if (priceData && priceData.price > 0) {
      const sgdPrice = await convertToSGD(priceData.price, region.currency);
      
      if (sgdPrice > 0) {
        return {
          region: region.name,
          regionCode: regionCode,
          originalPrice: priceData.price,
          currency: region.currency,
          sgdPrice: sgdPrice,
          title: priceData.title || game.title,
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

async function fetchPriceWithLibrary(nsuid, regionCode) {
  if (!nsuid) return null;
  
  try {
    const priceResponse = await getPrices(regionCode, nsuid);
    
    const priceInfo = priceResponse.prices?.[0];
    
    // Check if the game is available in this region
    if (!priceInfo || priceInfo.sales_status !== 'onsale') {
      console.log(`[NINTENDO-LIB] Game not available in ${regionCode}: ${priceInfo?.sales_status || 'no data'}`);
      return null;
    }
    
    // Extract price from the API response
    const regularPriceData = priceInfo.regular_price;
    const discountPriceData = priceInfo.discount_price;
    
    if (!regularPriceData || !regularPriceData.raw_value) {
      console.log(`[NINTENDO-LIB] No price data for ${regionCode}`);
      return null;
    }
    
    const regularPrice = parseFloat(regularPriceData.raw_value);
    const discountPrice = discountPriceData ? parseFloat(discountPriceData.raw_value) : null;
    
    if (isNaN(regularPrice) || regularPrice <= 0) {
      console.log(`[NINTENDO-LIB] Invalid price for ${regionCode}: ${regularPriceData.raw_value}`);
      return null;
    }
    
    const finalPrice = discountPrice || regularPrice;
    const discount = discountPrice ? 
      Math.round((1 - discountPrice / regularPrice) * 100) : 0;
    
    console.log(`[NINTENDO-LIB] ✅ Valid price for ${regionCode}: ${finalPrice} ${regularPriceData.currency}`);
    
    return {
      price: finalPrice,
      discount: discount,
      title: priceInfo.title || null
    };
    
  } catch (error) {
    console.log(`[NINTENDO-LIB] API error for ${regionCode}: ${error.message}`);
    return null;
  }
}

module.exports = { searchGames, searchGameByNSUID, REGIONS };