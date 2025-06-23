const axios = require('axios');

async function debugMarioSearch() {
  console.log('Debugging Mario Kart search...\n');
  
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
    console.log(`Found ${games.length} total results from Nintendo API:`);
    
    games.forEach((game, index) => {
      console.log(`${index + 1}. "${game.title}" - NSUID: ${game.nsuid_txt?.[0] || 'N/A'}`);
    });
    
    // Look specifically for Mario Kart games
    const marioKartGames = games.filter(game => 
      game.title && game.title.toLowerCase().includes('mario kart')
    );
    
    console.log(`\nMario Kart games found: ${marioKartGames.length}`);
    marioKartGames.forEach((game, index) => {
      console.log(`${index + 1}. "${game.title}" - NSUID: ${game.nsuid_txt?.[0] || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugMarioSearch();