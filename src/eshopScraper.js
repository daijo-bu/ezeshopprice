const { 
  getQueriedGamesAmerica,
  getQueriedGamesBrazil,
  getGamesEurope,
  getGamesJapan,
  getPrices,
  parseNSUID,
  Region,
  getShopsAmerica,
  getShopsEurope,
  getShopsAsia,
  getActiveShops
} = require('nintendo-switch-eshop');
const { convertToSGD } = require('./currencyConverter');

// Enhanced region data with purchase difficulty and gift card availability
// Smart search fallbacks for known problematic terms
const SEARCH_FALLBACKS = {
  'suikoden': ['Suikoden I', 'Suikoden HD', 'Suikoden Remaster', 'Suikoden I&II'],
  'chrono': ['Chrono Trigger', 'Chrono Cross'],
  'secret': ['Secret of Mana', 'Secret of Evermore'],
  'trials': ['Trials of Mana', 'Trials Rising'],
  'legend': ['Legend of Zelda', 'Legend of Mana'],
  'tales': ['Tales of', 'Tales Arise', 'Tales Symphonia'],
  'final': ['Final Fantasy'],
  'dragon': ['Dragon Quest', 'Dragon Ball'],
  'metal': ['Metal Slug', 'Metal Gear'],
  'sonic': ['Sonic Hedgehog', 'Sonic Mania', 'Sonic Origins']
};

async function trySmartSearchFallbacks(originalSearch) {
  const normalizedSearch = originalSearch.toLowerCase().trim();
  
  // Check if we have fallbacks for this search term
  const fallbacks = SEARCH_FALLBACKS[normalizedSearch];
  if (!fallbacks) return [];
  
  console.log(`[NINTENDO-LIB] Trying ${fallbacks.length} fallback searches for "${originalSearch}"`);
  
  for (const fallback of fallbacks) {
    try {
      console.log(`[NINTENDO-LIB] Trying fallback: "${fallback}"`);
      const games = await getQueriedGamesAmerica(fallback, { hitsPerPage: 30 });
      
      if (games.length > 0) {
        // Filter results to only include games that still match the original search intent
        const relevantGames = games.filter(game => {
          const title = (game.title || '').toLowerCase();
          // Make sure the game title contains the original search term or is clearly related
          return title.includes(normalizedSearch) || 
                 calculateMatchScore(originalSearch, game.title) > 100;
        });
        
        if (relevantGames.length > 0) {
          console.log(`[NINTENDO-LIB] Found ${relevantGames.length} relevant games with fallback "${fallback}"`);
          return relevantGames;
        }
      }
    } catch (error) {
      console.log(`[NINTENDO-LIB] Fallback "${fallback}" failed: ${error.message}`);
    }
  }
  
  return [];
}

// Enhanced region metadata for purchase difficulty and gift card availability
const REGION_METADATA = {
  'US': { difficult: false, giftCards: true },
  'CA': { difficult: false, giftCards: true },
  'MX': { difficult: true, giftCards: true },
  'BR': { difficult: true, giftCards: true },
  'AR': { difficult: true, giftCards: true },
  'CL': { difficult: true, giftCards: false },
  'CO': { difficult: true, giftCards: false },
  'PE': { difficult: true, giftCards: false },
  'GB': { difficult: false, giftCards: true },
  'DE': { difficult: false, giftCards: true },
  'FR': { difficult: false, giftCards: true },
  'ES': { difficult: false, giftCards: true },
  'IT': { difficult: false, giftCards: true },
  'NL': { difficult: false, giftCards: true },
  'BE': { difficult: false, giftCards: false },
  'AT': { difficult: false, giftCards: false },
  'LU': { difficult: false, giftCards: false },
  'CH': { difficult: true, giftCards: false },
  'NO': { difficult: true, giftCards: false },
  'SE': { difficult: false, giftCards: false },
  'DK': { difficult: false, giftCards: false },
  'FI': { difficult: false, giftCards: false },
  'PL': { difficult: true, giftCards: false },
  'CZ': { difficult: true, giftCards: false },
  'SK': { difficult: true, giftCards: false },
  'HU': { difficult: true, giftCards: false },
  'SI': { difficult: true, giftCards: false },
  'HR': { difficult: true, giftCards: false },
  'BG': { difficult: true, giftCards: false },
  'RO': { difficult: true, giftCards: false },
  'EE': { difficult: true, giftCards: false },
  'LV': { difficult: true, giftCards: false },
  'LT': { difficult: true, giftCards: false },
  'PT': { difficult: false, giftCards: true },
  'GR': { difficult: true, giftCards: false },
  'MT': { difficult: true, giftCards: false },
  'CY': { difficult: true, giftCards: false },
  'IE': { difficult: false, giftCards: false },
  'RU': { difficult: true, giftCards: true },
  'JP': { difficult: true, giftCards: true },
  'AU': { difficult: false, giftCards: true },
  'NZ': { difficult: false, giftCards: false },
  'ZA': { difficult: true, giftCards: true }
};

// Cache for active shops (refresh every hour)
let activeShopsCache = null;
let shopsCacheExpiry = 0;

async function getActiveShopsWithCache() {
  const now = Date.now();
  
  // Return cached data if still valid (1 hour cache)
  if (activeShopsCache && now < shopsCacheExpiry) {
    console.log(`[NINTENDO-LIB] Using cached shops data (${activeShopsCache.length} shops)`);
    return activeShopsCache;
  }
  
  console.log(`[NINTENDO-LIB] Fetching fresh shops data from Nintendo API...`);
  
  try {
    // Get all active shops from Nintendo's API
    const allShops = await getActiveShops();
    
    // Enhance with our metadata
    const enhancedShops = allShops.map(shop => ({
      ...shop,
      difficult: REGION_METADATA[shop.code]?.difficult || true,
      giftCards: REGION_METADATA[shop.code]?.giftCards || false
    }));
    
    // Cache the results for 1 hour
    activeShopsCache = enhancedShops;
    shopsCacheExpiry = now + (60 * 60 * 1000); // 1 hour
    
    console.log(`[NINTENDO-LIB] Cached ${enhancedShops.length} active shops from Nintendo API`);
    console.log(`[NINTENDO-LIB] Available shops: ${enhancedShops.map(s => s.code).join(', ')}`);
    
    return enhancedShops;
    
  } catch (error) {
    console.error(`[NINTENDO-LIB] Failed to fetch active shops: ${error.message}`);
    
    // If we have stale cached data, use it as fallback
    if (activeShopsCache) {
      console.log(`[NINTENDO-LIB] Using stale cached data as fallback`);
      return activeShopsCache;
    }
    
    // Last resort: return empty array
    return [];
  }
}

async function searchGames(gameName) {
  console.log(`[NINTENDO-LIB] Searching for games matching: ${gameName}`);
  
  try {
    // Use the nintendo-switch-eshop library to search for games
    let games = await getQueriedGamesAmerica(gameName, { hitsPerPage: 50 });
    
    // If no results, try smart fallbacks for known problematic searches
    if (games.length === 0) {
      const fallbackResults = await trySmartSearchFallbacks(gameName);
      if (fallbackResults.length > 0) {
        games = fallbackResults;
        console.log(`[NINTENDO-LIB] Found ${games.length} games using smart fallback search`);
      }
    }
    
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
  
  // Known regional NSUIDs for popular games (verified to work)
  const knownNSUIDs = {
    'mario kart 8 deluxe': {
      americas: '70010000000153',
      europe: '70010000000126',
      asia: '70010000000186'
    },
    'super mario odyssey': {
      americas: '70010000000554',
      europe: '70010000000588',
      asia: '70010000000619'
    },
    'zelda breath': {
      americas: '70010000000025',
      europe: '70010000000023',
      asia: '70010000000026'
    }
  };
  
  // Check if this is a known game
  const lowerTitle = gameTitle.toLowerCase();
  for (const [key, nsuids] of Object.entries(knownNSUIDs)) {
    if (lowerTitle.includes(key) || key.split(' ').every(word => lowerTitle.includes(word))) {
      console.log(`[NINTENDO-LIB] Using known NSUIDs for ${key}`);
      Object.assign(regionalNSUIDs, nsuids);
      console.log(`[NINTENDO-LIB] Known NSUIDs - Americas: ${regionalNSUIDs.americas}, Europe: ${regionalNSUIDs.europe}, Asia: ${regionalNSUIDs.asia}`);
      return regionalNSUIDs;
    }
  }
  
  try {
    // Multi-strategy search for each region
    const searchStrategies = [
      gameTitle,
      gameTitle.replace(/[^\w\s]/g, ''), // Remove special characters
      gameTitle.split(':')[0].trim(),    // Take part before colon
      gameTitle.split('-')[0].trim(),    // Take part before dash
      gameTitle.split(' ').slice(0, 3).join(' ') // First 3 words
    ].filter((term, index, arr) => arr.indexOf(term) === index && term.length > 2);
    
    console.log(`[NINTENDO-LIB] Using ${searchStrategies.length} search strategies: ${searchStrategies.join(', ')}`);
    
    // Search Americas using multiple strategies
    console.log(`[NINTENDO-LIB] Searching Americas using getQueriedGamesAmerica...`);
    let bestAmericanMatch = null;
    
    for (const searchTerm of searchStrategies) {
      try {
        const americanGames = await getQueriedGamesAmerica(searchTerm, { hitsPerPage: 30 });
        bestAmericanMatch = findBestMatch(gameTitle, americanGames);
        if (bestAmericanMatch) {
          console.log(`[NINTENDO-LIB] Found Americas match using "${searchTerm}"`);
          break;
        }
      } catch (err) {
        console.log(`[NINTENDO-LIB] Americas search failed for "${searchTerm}": ${err.message}`);
      }
    }
    
    if (bestAmericanMatch) {
      // Use parseNSUID to properly extract the NSUID
      const extractedNSUID = parseNSUID(bestAmericanMatch, Region.AMERICAS);
      if (extractedNSUID) {
        regionalNSUIDs.americas = extractedNSUID;
        console.log(`[NINTENDO-LIB] Americas NSUID: ${extractedNSUID} for "${bestAmericanMatch.title}"`);
      }
    }
    
    // Search Brazil for potentially different NSUID using multiple strategies
    console.log(`[NINTENDO-LIB] Searching Brazil using getQueriedGamesBrazil...`);
    let bestBrazilMatch = null;
    
    for (const searchTerm of searchStrategies) {
      try {
        const brazilGames = await getQueriedGamesBrazil(searchTerm, { hitsPerPage: 30 });
        bestBrazilMatch = findBestMatch(gameTitle, brazilGames);
        if (bestBrazilMatch) {
          console.log(`[NINTENDO-LIB] Found Brazil match using "${searchTerm}"`);
          break;
        }
      } catch (err) {
        console.log(`[NINTENDO-LIB] Brazil search failed for "${searchTerm}": ${err.message}`);
      }
    }
    
    if (bestBrazilMatch) {
      const brazilNSUID = parseNSUID(bestBrazilMatch, Region.AMERICAS); // Brazil uses Americas region
      if (brazilNSUID && brazilNSUID !== regionalNSUIDs.americas) {
        regionalNSUIDs.brazil = brazilNSUID;
        console.log(`[NINTENDO-LIB] Brazil specific NSUID: ${brazilNSUID} for "${bestBrazilMatch.title}"`);
      }
    }
    
    // Search Europe using the complete games list with multiple strategies
    console.log(`[NINTENDO-LIB] Searching Europe using getGamesEurope...`);
    let bestEuropeanMatch = null;
    
    try {
      const europeanGames = await getGamesEurope({ limit: 2000, locale: 'en' });
      console.log(`[NINTENDO-LIB] Searching through ${europeanGames.length} European games...`);
      
      // Try each search strategy for Europe
      for (const searchTerm of searchStrategies) {
        bestEuropeanMatch = findBestMatchInList(searchTerm, europeanGames);
        if (bestEuropeanMatch) {
          console.log(`[NINTENDO-LIB] Found Europe match using "${searchTerm}"`);
          break;
        }
      }
      
      if (bestEuropeanMatch) {
        const europeNSUID = parseNSUID(bestEuropeanMatch, Region.EUROPE);
        if (europeNSUID) {
          regionalNSUIDs.europe = europeNSUID;
          console.log(`[NINTENDO-LIB] Europe NSUID: ${europeNSUID} for "${bestEuropeanMatch.title}"`);
        }
      } else {
        console.log(`[NINTENDO-LIB] No European match found for "${gameTitle}"`);
      }
    } catch (euroError) {
      console.log(`[NINTENDO-LIB] Error searching European games: ${euroError.message}`);
    }
    
    // Search Japan/Asia using the complete games list with multiple strategies
    console.log(`[NINTENDO-LIB] Searching Japan/Asia using getGamesJapan...`);
    let bestJapaneseMatch = null;
    
    try {
      const japaneseGames = await getGamesJapan();
      console.log(`[NINTENDO-LIB] Searching through ${japaneseGames.length} Japanese games...`);
      
      // Try each search strategy for Asia/Japan
      for (const searchTerm of searchStrategies) {
        bestJapaneseMatch = findBestMatchInList(searchTerm, japaneseGames);
        if (bestJapaneseMatch) {
          console.log(`[NINTENDO-LIB] Found Asia match using "${searchTerm}"`);
          break;
        }
      }
      
      // Special handling for games that might have Japanese titles
      if (!bestJapaneseMatch) {
        const japaneseTerms = getJapaneseSearchTerms(gameTitle);
        for (const japaneseTerm of japaneseTerms) {
          bestJapaneseMatch = japaneseGames.find(game => 
            game.title && game.title.includes(japaneseTerm)
          );
          if (bestJapaneseMatch) {
            console.log(`[NINTENDO-LIB] Found Asia match using Japanese term "${japaneseTerm}"`);
            break;
          }
        }
      }
      
      if (bestJapaneseMatch) {
        const asianNSUID = parseNSUID(bestJapaneseMatch, Region.ASIA);
        if (asianNSUID) {
          regionalNSUIDs.asia = asianNSUID;
          console.log(`[NINTENDO-LIB] Asia NSUID: ${asianNSUID} for "${bestJapaneseMatch.title}"`);
        }
      } else {
        console.log(`[NINTENDO-LIB] No Asian match found for "${gameTitle}"`);
      }
    } catch (asiaError) {
      console.log(`[NINTENDO-LIB] Error searching Japanese games: ${asiaError.message}`);
    }
    
  } catch (error) {
    console.log(`[NINTENDO-LIB] Error finding regional NSUIDs: ${error.message}`);
  }
  
  console.log(`[NINTENDO-LIB] Regional NSUID discovery complete. Found: Americas=${regionalNSUIDs.americas}, Brazil=${regionalNSUIDs.brazil || 'N/A'}, Europe=${regionalNSUIDs.europe || 'N/A'}, Asia=${regionalNSUIDs.asia || 'N/A'}`);
  return regionalNSUIDs;
}

// Helper function to find the best matching game from a list
function findBestMatch(searchTitle, games) {
  if (!games || games.length === 0) return null;
  
  const normalizedSearch = searchTitle.toLowerCase().trim();
  
  // Try exact match first
  let exactMatch = games.find(game => 
    game.title && game.title.toLowerCase() === normalizedSearch
  );
  if (exactMatch) return exactMatch;
  
  // Score all games and find the best match
  const scoredGames = games
    .filter(game => game.title && game.title.trim().length > 0)
    .map(game => ({
      game,
      score: calculateMatchScore(normalizedSearch, game.title.toLowerCase())
    }))
    .filter(item => item.score > 800) // Higher threshold for better matches
    .sort((a, b) => b.score - a.score);
  
  return scoredGames.length > 0 ? scoredGames[0].game : null;
}

// Helper function to find best match in a pre-loaded list (for Europe/Asia)
function findBestMatchInList(searchTitle, games) {
  if (!games || games.length === 0) return null;
  
  const normalizedSearch = searchTitle.toLowerCase().trim();
  
  // Filter games that might match
  const relevantGames = games.filter(game => {
    if (!game.title) return false;
    const title = game.title.toLowerCase();
    return title.includes(normalizedSearch) || 
           normalizedSearch.includes(title) ||
           calculateMatchScore(searchTitle, game.title) > 500;
  });
  
  if (relevantGames.length === 0) return null;
  
  // Find the best match among relevant games
  const bestMatch = relevantGames
    .map(game => ({
      game,
      score: calculateMatchScore(searchTitle, game.title)
    }))
    .sort((a, b) => b.score - a.score)[0];
  
  return bestMatch && bestMatch.score > 800 ? bestMatch.game : null;
}

// Helper function to get Japanese search terms for known games
function getJapaneseSearchTerms(gameTitle) {
  const lowerTitle = gameTitle.toLowerCase();
  const japaneseTerms = [];
  
  // Known Japanese translations for popular games
  if (lowerTitle.includes('mario kart')) japaneseTerms.push('マリオカート');
  if (lowerTitle.includes('zelda')) japaneseTerms.push('ゼルダ');
  if (lowerTitle.includes('pokemon')) japaneseTerms.push('ポケモン');
  if (lowerTitle.includes('metroid')) japaneseTerms.push('メトロイド');
  if (lowerTitle.includes('kirby')) japaneseTerms.push('カービィ');
  if (lowerTitle.includes('splatoon')) japaneseTerms.push('スプラトゥーン');
  if (lowerTitle.includes('xenoblade')) japaneseTerms.push('ゼノブレイド');
  if (lowerTitle.includes('fire emblem')) japaneseTerms.push('ファイアーエムブレム');
  
  return japaneseTerms;
}

async function getPricesForGame(game) {
  console.log(`[NINTENDO-LIB] Fetching real prices for: ${game.title}`);
  
  const prices = [];
  
  // Get all active shops dynamically from Nintendo's API
  const activeShops = await getActiveShopsWithCache();
  
  if (activeShops.length === 0) {
    console.log(`[NINTENDO-LIB] No active shops available`);
    return [];
  }
  
  console.log(`[NINTENDO-LIB] Checking prices across ${activeShops.length} active Nintendo eShops`);
  
  // Find regional NSUIDs for comprehensive pricing
  const regionalNSUIDs = await findRegionalNSUIDs(game.title, game.nsuid);
  
  // Phase 1: Try original NSUID in ALL active shops
  console.log(`[NINTENDO-LIB] Phase 1: Testing original NSUID ${regionalNSUIDs.americas || game.nsuid} in all ${activeShops.length} shops...`);
  
  const phase1Promises = activeShops.map(shop => 
    fetchPriceForShop(regionalNSUIDs.americas || game.nsuid, shop, game.title)
  );
  
  const phase1Results = await Promise.allSettled(phase1Promises);
  const phase1SuccessShops = [];
  
  phase1Results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      prices.push(result.value);
      phase1SuccessShops.push(activeShops[index].code);
    }
  });
  
  console.log(`[NINTENDO-LIB] Phase 1 completed: Found prices in ${phase1SuccessShops.length} shops using original NSUID`);
  
  // Phase 2: Try regional NSUIDs for shops that failed in Phase 1
  const failedShops = activeShops.filter(shop => !phase1SuccessShops.includes(shop.code));
  
  if (failedShops.length > 0 && (regionalNSUIDs.europe || regionalNSUIDs.asia || regionalNSUIDs.brazil)) {
    console.log(`[NINTENDO-LIB] Phase 2: Testing regional NSUIDs for ${failedShops.length} failed shops...`);
    
    // Group shops by their likely regional NSUID
    const shopGroups = [
      {
        nsuid: regionalNSUIDs.brazil,
        shops: failedShops.filter(shop => shop.region === 1 && ['BR'].includes(shop.code)) // Americas region, Brazil
      },
      {
        nsuid: regionalNSUIDs.europe,
        shops: failedShops.filter(shop => shop.region === 2) // Europe region
      },
      {
        nsuid: regionalNSUIDs.asia,
        shops: failedShops.filter(shop => shop.region === 3) // Asia region
      }
    ];
    
    for (const group of shopGroups) {
      if (!group.nsuid || group.shops.length === 0) continue;
      
      console.log(`[NINTENDO-LIB] Testing NSUID ${group.nsuid} in ${group.shops.length} shops...`);
      
      const groupPromises = group.shops.map(shop => 
        fetchPriceForShop(group.nsuid, shop, game.title)
      );
      
      const groupResults = await Promise.allSettled(groupPromises);
      
      groupResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          prices.push(result.value);
        }
      });
      
      // Rate limiting between groups
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  console.log(`[NINTENDO-LIB] Total real prices found: ${prices.length} across ${activeShops.length} possible shops`);
  console.log(`[NINTENDO-LIB] NSUIDs used - Americas: ${regionalNSUIDs.americas || game.nsuid}, Europe: ${regionalNSUIDs.europe || 'N/A'}, Asia: ${regionalNSUIDs.asia || 'N/A'}, Brazil: ${regionalNSUIDs.brazil || 'N/A'}`);
  
  return prices
    .filter(p => p.sgdPrice > 0)
    .sort((a, b) => a.sgdPrice - b.sgdPrice);
}

async function fetchPriceForShop(nsuid, shop, gameTitle) {
  if (!nsuid || !shop) return null;
  
  try {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    const priceData = await fetchPriceWithLibrary(nsuid, shop.code);
    
    if (priceData && priceData.price > 0) {
      const sgdPrice = await convertToSGD(priceData.price, shop.currency);
      
      if (sgdPrice > 0) {
        console.log(`[NINTENDO-LIB] ✅ Got price for ${shop.code} using NSUID ${nsuid}: ${priceData.price} ${shop.currency} = S$${sgdPrice.toFixed(2)}`);
        
        return {
          region: shop.country,
          regionCode: shop.code,
          originalPrice: priceData.price,
          currency: shop.currency,
          sgdPrice: sgdPrice,
          title: gameTitle,
          discount: priceData.discount || 0,
          difficult: shop.difficult,
          giftCards: shop.giftCards
        };
      }
    }
  } catch (error) {
    // Silently fail for individual shops
  }
  
  return null;
}

// Legacy compatibility functions
async function fetchPriceForRegion(game, region, regionCode) {
  return fetchPriceForRegionWithNSUID(game.nsuid, regionCode, game.title);
}

async function fetchPriceForRegionWithNSUID(nsuid, regionCode, gameTitle) {
  // Get shop info from active shops
  const activeShops = await getActiveShopsWithCache();
  const shop = activeShops.find(s => s.code === regionCode);
  
  if (!shop) return null;
  
  return fetchPriceForShop(nsuid, shop, gameTitle);
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

module.exports = { searchGames, searchGameByNSUID, getActiveShopsWithCache };