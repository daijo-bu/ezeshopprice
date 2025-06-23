const axios = require('axios');

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
        score += 150;
      } else if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        partialWordMatches++;
        score += 75;
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

async function debugFiltering() {
  console.log('=== Debugging EXACT filtering logic used by live bot ===\n');
  
  try {
    const response = await axios.get('https://searching.nintendo-europe.com/en/select', {
      params: {
        q: 'mario kart 8',
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
    console.log(`Raw search results: ${searchResults.length} games`);
    
    // Step 1: Filter out games without NSUID first
    const gamesWithNSUID = searchResults.filter(game => game.nsuid_txt?.[0]);
    console.log(`After NSUID filter: ${gamesWithNSUID.length} games`);
    
    // Step 2: Score them
    const scoredGames = gamesWithNSUID.map(game => ({
      game,
      score: calculateMatchScore('mario kart 8', game)
    }));
    
    console.log('\nAll games with NSUID and their scores:');
    scoredGames.forEach((item, index) => {
      console.log(`${index + 1}. "${item.game.title}" - Score: ${item.score}, NSUID: ${item.game.nsuid_txt[0]}`);
    });
    
    // Step 3: Filter by score > 20
    const goodMatches = scoredGames.filter(item => item.score > 20);
    console.log(`\nAfter score filter (>20): ${goodMatches.length} games`);
    
    // Step 4: Sort by score
    const sortedGames = goodMatches.sort((a, b) => b.score - a.score);
    
    console.log('\nFinal sorted results:');
    sortedGames.forEach((item, index) => {
      console.log(`${index + 1}. "${item.game.title}" - Score: ${item.score}`);
    });
    
    // Look specifically for Mario Kart 8 Deluxe
    const marioKartGame = searchResults.find(game => 
      game.title && game.title.toLowerCase().includes('mario kart 8')
    );
    
    if (marioKartGame) {
      console.log('\n=== FOUND MARIO KART 8 DELUXE IN RAW RESULTS ===');
      console.log('Title:', marioKartGame.title);
      console.log('NSUID:', marioKartGame.nsuid_txt?.[0]);
      console.log('Has NSUID?', !!marioKartGame.nsuid_txt?.[0]);
      
      const score = calculateMatchScore('mario kart 8', marioKartGame);
      console.log('Score:', score);
      console.log('Score > 20?', score > 20);
    } else {
      console.log('\n❌ Mario Kart 8 Deluxe NOT found in raw search results');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugFiltering();