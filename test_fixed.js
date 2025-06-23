const { searchGames } = require('./src/eshopScraper_fixed');

async function testFixed() {
  console.log('Testing the FIXED scraper...\n');
  
  const testCases = [
    'mario kart 8',
    'mario kart',
    'zelda breath',
    'mario tennis'
  ];
  
  for (const gameName of testCases) {
    console.log(`\n=== Testing: "${gameName}" ===`);
    
    try {
      const result = await searchGames(gameName);
      
      console.log(`Result type: ${result.type}`);
      
      switch (result.type) {
        case 'no_results':
          console.log(`Message: ${result.message}`);
          break;
          
        case 'no_prices':
          console.log(`Game: ${result.game.title}`);
          console.log(`Message: ${result.message}`);
          break;
          
        case 'multiple_options':
          console.log(`Message: ${result.message}`);
          console.log('Top 3 options:');
          result.games.slice(0, 3).forEach((game, index) => {
            console.log(`  ${index + 1}. ${game.title} (Score: ${game.score}, NSUID: ${game.nsuid})`);
          });
          break;
          
        case 'prices':
          console.log(`✅ SINGLE MATCH: ${result.game.title}`);
          console.log(`Real prices found: ${result.prices.length}`);
          if (result.prices.length > 0) {
            console.log('Top 3 cheapest:');
            result.prices.slice(0, 3).forEach((price, index) => {
              const icons = (price.difficult ? ' 🔸' : '') + (price.giftCards ? ' 🎁' : '');
              console.log(`  ${index + 1}. ${price.region}${icons}: S$${price.sgdPrice.toFixed(2)} (${price.originalPrice.toFixed(2)} ${price.currency})`);
            });
          }
          break;
          
        case 'error':
          console.log(`Error: ${result.message}`);
          break;
      }
      
    } catch (error) {
      console.error(`Error testing "${gameName}":`, error.message);
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testFixed().catch(console.error);