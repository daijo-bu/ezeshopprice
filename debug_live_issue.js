const { searchGames } = require('./src/eshopScraper_real_only');

async function debugLiveIssue() {
  console.log('Debugging the exact issue from live bot...\n');
  
  try {
    console.log('=== Testing "mario kart 8" (exact query that failed) ===');
    const result = await searchGames('mario kart 8');
    
    console.log('Result type:', result.type);
    console.log('Result data:', JSON.stringify(result, null, 2));
    
    if (result.type === 'multiple_options') {
      console.log('\nThe bot found these games instead of Mario Kart 8 Deluxe:');
      result.games.forEach((game, index) => {
        console.log(`${index + 1}. "${game.title}" (NSUID: ${game.nsuid})`);
        console.log(`   Score: ${game.score}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugLiveIssue();