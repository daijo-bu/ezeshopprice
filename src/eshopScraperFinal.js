// Final comprehensive Nintendo eShop scraper with maximum regional coverage
const { 
  getQueriedGamesAmerica,
  getQueriedGamesBrazil,
  parseNSUID,
  Region
} = require('nintendo-switch-eshop');

const { getComprehensivePricesForGame, getAllRegionsCount } = require('./comprehensiveRegions');

// Import existing search functionality with enhancements
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

async function searchGamesFinal(gameName) {
  console.log(`[FINAL] Comprehensive search for: ${gameName} across ${getAllRegionsCount()} regions`);
  
  try {
    // Use existing search logic with enhancements
    let games = await getQueriedGamesAmerica(gameName, { hitsPerPage: 50 });
    
    // Smart search fallbacks if no results
    if (games.length === 0) {
      const fallbackResults = await trySmartSearchFallbacks(gameName);
      if (fallbackResults.length > 0) {
        games = fallbackResults;
        console.log(`[FINAL] Found ${games.length} games using smart fallback search`);
      }
    }
    
    if (games.length === 0) {
      return { 
        type: 'no_results', 
        message: `No games found for "${gameName}". Try a different search term or check spelling.` 
      };
    }
    
    // Score and filter results
    const scoredGames = games
      .filter(game => game.nsuid && game.nsuid !== 'MOBILE')
      .map(game => ({
        title: game.title,
        nsuid: game.nsuid,
        developer: game.developers?.[0] || 'Unknown',
        publisher: game.publishers?.[0] || 'Unknown',
        image: game.boxart,
        releaseDate: game.releaseDateDisplay,
        score: calculateMatchScore(gameName, game.title)
      }))
      .filter(game => game.score > 30)
      .sort((a, b) => b.score - a.score);
    
    if (scoredGames.length === 0) {
      return { 
        type: 'no_results', 
        message: `No relevant games found for "${gameName}". Try a different search term.` 
      };
    }
    
    console.log(`[FINAL] Found ${scoredGames.length} valid matches`);
    
    // Check if we have a clear winner
    if (scoredGames.length === 1 || (scoredGames.length > 1 && scoredGames[0].score > scoredGames[1].score * 1.5)) {
      console.log(`[FINAL] Clear winner: ${scoredGames[0].title} (score: ${scoredGames[0].score})`);
      
      // Get comprehensive pricing across ALL regions
      const prices = await getComprehensivePricesForGame(scoredGames[0]);
      
      if (prices.length === 0) {
        return { 
          type: 'no_prices', 
          game: scoredGames[0],
          message: `Found "${scoredGames[0].title}" but no pricing data is available across any of the ${getAllRegionsCount()} monitored regions.` 
        };
      }
      
      return { 
        type: 'prices', 
        game: scoredGames[0],
        prices: prices,
        totalRegionsChecked: getAllRegionsCount()
      };
    }
    
    // Multiple matches - return options
    console.log(`[FINAL] Multiple matches found: ${scoredGames.length} games`);
    return { 
      type: 'multiple_options', 
      games: scoredGames.slice(0, 5),
      message: `Found ${scoredGames.length} games matching "${gameName}". Please select which game you want:` 
    };
    
  } catch (error) {
    console.error(`[FINAL] Search error: ${error.message}`);
    
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

async function searchGameByNSUIDFinal(nsuid) {
  console.log(`[FINAL] Getting comprehensive prices for NSUID: ${nsuid}`);
  
  try {
    // Try to find the game title
    let gameTitle = 'Selected Game';
    try {
      const recentGames = await getQueriedGamesAmerica('', { hitsPerPage: 200 });
      const matchingGame = recentGames.find(game => game.nsuid === nsuid);
      if (matchingGame) {
        gameTitle = matchingGame.title;
        console.log(`[FINAL] Found game title for NSUID ${nsuid}: ${gameTitle}`);
      }
    } catch (titleError) {
      console.log(`[FINAL] Could not fetch title for NSUID ${nsuid}, using generic title`);
    }
    
    const gameDetails = {
      title: gameTitle,
      nsuid: nsuid,
      developer: 'Unknown',
      publisher: 'Unknown'
    };
    
    // Get comprehensive pricing
    const prices = await getComprehensivePricesForGame(gameDetails);
    
    if (prices.length === 0) {
      return { 
        type: 'no_prices', 
        game: gameDetails,
        message: `No pricing data available for "${gameDetails.title}" across any of the ${getAllRegionsCount()} monitored regions.` 
      };
    }
    
    return { 
      type: 'prices', 
      game: gameDetails,
      prices: prices,
      totalRegionsChecked: getAllRegionsCount()
    };
    
  } catch (error) {
    console.error(`[FINAL] NSUID search error: ${error.message}`);
    
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

async function trySmartSearchFallbacks(originalSearch) {
  const normalizedSearch = originalSearch.toLowerCase().trim();
  const fallbacks = SEARCH_FALLBACKS[normalizedSearch];
  if (!fallbacks) return [];
  
  console.log(`[FINAL] Trying ${fallbacks.length} fallback searches for "${originalSearch}"`);
  
  for (const fallback of fallbacks) {
    try {
      console.log(`[FINAL] Trying fallback: "${fallback}"`);
      const games = await getQueriedGamesAmerica(fallback, { hitsPerPage: 30 });
      
      if (games.length > 0) {
        const relevantGames = games.filter(game => {
          const title = (game.title || '').toLowerCase();
          return title.includes(normalizedSearch) || 
                 calculateMatchScore(originalSearch, game.title) > 100;
        });
        
        if (relevantGames.length > 0) {
          console.log(`[FINAL] Found ${relevantGames.length} relevant games with fallback "${fallback}"`);
          return relevantGames;
        }
      }
    } catch (error) {
      console.log(`[FINAL] Fallback "${fallback}" failed: ${error.message}`);
    }
  }
  
  return [];
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

module.exports = { 
  searchGamesFinal, 
  searchGameByNSUIDFinal,
  getAllRegionsCount
};