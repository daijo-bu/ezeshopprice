const axios = require('axios');

function calculateMatchScore(searchTerm, game) {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const title = (game.title || '').toLowerCase();
  let score = 0;
  
  console.log(`\nScoring "${game.title}" against "${searchTerm}"`);
  
  // Exact match gets highest score
  if (title === normalizedSearch) {
    console.log('  Exact match: +1000');
    return 1000;
  }
  
  // Title starts with search term
  if (title.startsWith(normalizedSearch)) {
    score += 800;
    console.log('  Starts with search: +800');
  }
  
  // Title contains search term
  if (title.includes(normalizedSearch)) {
    score += 500;
    console.log('  Contains search: +500');
  }
  
  // Search term contains title (for shorter titles)
  if (normalizedSearch.includes(title)) {
    score += 300;
    console.log('  Search contains title: +300');
  }
  
  // Enhanced word-by-word matching
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 1);
  const titleWords = title.split(' ').filter(w => w.length > 1);
  
  console.log(`  Search words: [${searchWords.join(', ')}]`);
  console.log(`  Title words: [${titleWords.join(', ')}]`);
  
  let exactWordMatches = 0;
  let partialWordMatches = 0;
  
  searchWords.forEach(searchWord => {
    titleWords.forEach(titleWord => {
      if (searchWord === titleWord) {
        exactWordMatches++;
        score += 150;
        console.log(`  Exact word match "${searchWord}": +150`);
      } else if (titleWord.includes(searchWord) || searchWord.includes(titleWord)) {
        partialWordMatches++;
        score += 75;
        console.log(`  Partial word match "${searchWord}"/"${titleWord}": +75`);
      }
    });
  });
  
  // Special handling for common game series
  const gameSeriesBonus = getGameSeriesBonus(normalizedSearch, title);
  if (gameSeriesBonus > 0) {
    score += gameSeriesBonus;
    console.log(`  Game series bonus: +${gameSeriesBonus}`);
  }
  
  // Bonus for matching most search words exactly
  if (exactWordMatches >= Math.max(1, searchWords.length - 1)) {
    score += 300;
    console.log(`  Most words matched exactly: +300`);
  }
  
  // Bonus for matching all search words (exact or partial)
  if (exactWordMatches + partialWordMatches >= searchWords.length && searchWords.length > 1) {
    score += 150;
    console.log(`  All words matched: +150`);
  }
  
  console.log(`  Final score: ${score}`);
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

async function debugScoring() {
  console.log('Debugging Mario Kart scoring...\n');
  
  try {
    const response = await axios.get('https://searching.nintendo-europe.com/en/select', {
      params: {
        q: 'Mario Kart 8',
        fq: 'type:GAME AND system_type:nintendoswitch*',
        rows: 20,
        start: 0,
        sort: 'popularity desc',
        wt: 'json'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    const games = response.data?.response?.docs || [];
    const gamesWithNSUID = games.filter(game => game.nsuid_txt?.[0]);
    
    console.log('Games with NSUID and their scores:');
    
    gamesWithNSUID.forEach(game => {
      const score = calculateMatchScore('Mario Kart 8', game);
      if (score > 50) { // Only show games with decent scores
        console.log(`"${game.title}" - Score: ${score}, NSUID: ${game.nsuid_txt[0]}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugScoring();