const { 
  getQueriedGamesAmerica,
  getGamesEurope,
  getGamesJapan,
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
    // Try to find the game title by searching recent popular games
    let gameTitle = 'Selected Game';
    try {
      const recentGames = await getQueriedGamesAmerica('', { hitsPerPage: 200 });
      const matchingGame = recentGames.find(game => game.nsuid === nsuid);
      if (matchingGame) {
        gameTitle = matchingGame.title;
        console.log(`[NINTENDO-LIB] Found game title for NSUID ${nsuid}: ${gameTitle}`);
      }
    } catch (titleError) {
      console.log(`[NINTENDO-LIB] Could not fetch title for NSUID ${nsuid}, using generic title`);
    }
    
    // Create a game object for the NSUID
    const gameDetails = {
      title: gameTitle,
      nsuid: nsuid,
      developer: 'Unknown',
      publisher: 'Unknown'
    };
    
    const prices = await getPricesForGame(gameDetails);
    
    if (prices.length === 0) {
      return { 
        type: 'no_prices', 
        game: gameDetails,
        message: `No real pricing data available for "${gameDetails.title}".` 
      };
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

async function findRegionalNSUIDs(gameTitle, originalNSUID) {
  console.log(`[NINTENDO-LIB] Finding regional NSUIDs for: ${gameTitle}`);
  
  const regionalNSUIDs = {
    americas: originalNSUID // Start with the original NSUID as Americas fallback
  };
  
  // For Mario Kart 8 Deluxe, use known regional NSUIDs
  if (gameTitle.toLowerCase().includes('mario kart') && gameTitle.toLowerCase().includes('8') && gameTitle.toLowerCase().includes('deluxe')) {
    console.log(`[NINTENDO-LIB] Using known Mario Kart 8 Deluxe NSUIDs`);
    regionalNSUIDs.americas = '70010000000153'; // Known Americas NSUID
    regionalNSUIDs.europe = '70010000000126';   // Known Europe NSUID
    regionalNSUIDs.asia = '70010000000186';     // Known Asia NSUID
    
    console.log(`[NINTENDO-LIB] Mario Kart 8 Deluxe NSUIDs - Americas: ${regionalNSUIDs.americas}, Europe: ${regionalNSUIDs.europe}, Asia: ${regionalNSUIDs.asia}`);
    return regionalNSUIDs;
  }
  
  try {
    // Search in Americas for exact match
    const americanGames = await getQueriedGamesAmerica(gameTitle, { hitsPerPage: 30 });
    const exactAmericanMatch = americanGames.find(game => 
      game.title && game.title.toLowerCase() === gameTitle.toLowerCase()
    );
    const goodAmericanMatch = exactAmericanMatch || americanGames.find(game => 
      game.title && calculateMatchScore(gameTitle, game.title) > 1500
    );
    
    if (goodAmericanMatch) {
      regionalNSUIDs.americas = goodAmericanMatch.nsuid;
      console.log(`[NINTENDO-LIB] Americas NSUID: ${goodAmericanMatch.nsuid} for "${goodAmericanMatch.title}"`);
    }
    
    // Search in Europe
    const europeanGames = await getGamesEurope({ limit: 500 });
    const exactEuropeanMatch = europeanGames.find(game => 
      game.title && game.title.toLowerCase() === gameTitle.toLowerCase()
    );
    const goodEuropeanMatch = exactEuropeanMatch || europeanGames.find(game => 
      game.title && calculateMatchScore(gameTitle, game.title) > 1500
    );
    
    if (goodEuropeanMatch) {
      regionalNSUIDs.europe = goodEuropeanMatch.nsuid_txt?.[0];
      console.log(`[NINTENDO-LIB] Europe NSUID: ${goodEuropeanMatch.nsuid_txt?.[0]} for "${goodEuropeanMatch.title}"`);
    }
    
    // Search in Japan
    const japaneseGames = await getGamesJapan();
    const exactJapaneseMatch = japaneseGames.find(game => 
      game.title && game.title.toLowerCase() === gameTitle.toLowerCase()
    );
    const goodJapaneseMatch = exactJapaneseMatch || japaneseGames.find(game => 
      game.title && (
        calculateMatchScore(gameTitle, game.title) > 1500 ||
        (gameTitle.toLowerCase().includes('mario kart') && game.title.includes('マリオカート'))
      )
    );
    
    if (goodJapaneseMatch) {
      regionalNSUIDs.asia = goodJapaneseMatch.nsuid;
      console.log(`[NINTENDO-LIB] Asia NSUID: ${goodJapaneseMatch.nsuid} for "${goodJapaneseMatch.title}"`);
    }
    
  } catch (error) {
    console.log(`[NINTENDO-LIB] Error finding regional NSUIDs: ${error.message}`);
  }
  
  return regionalNSUIDs;
}

async function getPricesForGame(game) {
  console.log(`[NINTENDO-LIB] Fetching real prices for: ${game.title}`);
  
  const prices = [];
  
  // Find regional NSUIDs for comprehensive pricing
  const regionalNSUIDs = await findRegionalNSUIDs(game.title, game.nsuid);
  
  // Define region groups and their corresponding NSUIDs
  const regionGroups = [
    {
      nsuid: regionalNSUIDs.americas || game.nsuid,
      regions: ['US', 'CA', 'MX', 'BR', 'AR', 'CL']
    },
    {
      nsuid: regionalNSUIDs.europe,
      regions: ['GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AT', 'CH', 'NO', 'SE', 'DK']
    },
    {
      nsuid: regionalNSUIDs.asia,
      regions: ['JP', 'AU', 'NZ', 'HK', 'KR', 'TW', 'SG', 'MY', 'TH']
    }
  ];
  
  // Add remaining regions to americas group as fallback
  const allDefinedRegions = regionGroups.flatMap(group => group.regions);
  const remainingRegions = Object.keys(REGIONS).filter(code => !allDefinedRegions.includes(code));
  regionGroups[0].regions.push(...remainingRegions);
  
  console.log(`[NINTENDO-LIB] Using NSUIDs - Americas: ${regionalNSUIDs.americas || game.nsuid}, Europe: ${regionalNSUIDs.europe || 'N/A'}, Asia: ${regionalNSUIDs.asia || 'N/A'}`);
  
  // Fetch prices for each region group
  for (const group of regionGroups) {
    if (!group.nsuid) continue;
    
    console.log(`[NINTENDO-LIB] Fetching prices for NSUID ${group.nsuid} in ${group.regions.length} regions...`);
    
    const groupPromises = group.regions.map(regionCode => 
      fetchPriceForRegionWithNSUID(group.nsuid, regionCode, game.title)
    );
    
    const groupResults = await Promise.allSettled(groupPromises);
    
    groupResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    });
    
    // Rate limiting between region groups
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`[NINTENDO-LIB] Total real prices found: ${prices.length}`);
  
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice)
    .slice(0, 25);
}

async function fetchPriceForRegion(game, region, regionCode) {
  return fetchPriceForRegionWithNSUID(game.nsuid, regionCode, game.title);
}

async function fetchPriceForRegionWithNSUID(nsuid, regionCode, gameTitle) {
  if (!nsuid || !REGIONS[regionCode]) return null;
  
  const region = REGIONS[regionCode];
  
  try {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const priceData = await fetchPriceWithLibrary(nsuid, regionCode);
    
    if (priceData && priceData.price > 0) {
      const sgdPrice = await convertToSGD(priceData.price, region.currency);
      
      if (sgdPrice > 0) {
        console.log(`[NINTENDO-LIB] ✅ Got price for ${regionCode} using NSUID ${nsuid}: ${priceData.price} ${region.currency} = S$${sgdPrice.toFixed(2)}`);
        
        return {
          region: region.name,
          regionCode: regionCode,
          originalPrice: priceData.price,
          currency: region.currency,
          sgdPrice: sgdPrice,
          title: gameTitle,
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