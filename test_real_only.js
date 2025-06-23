const { searchGames } = require('./src/eshopScraper_real_only');

async function testRealOnlyScraper() {
  console.log('Testing real-only Nintendo eShop scraper...\n');
  
  const testCases = [
    'Mario Kart 8',
    'Mario Kart World', // Should show multiple options
    'Zelda Breath',
    'Nonexistent Game 12345'
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
          console.log('Options:');
          result.games.forEach((game, index) => {
            console.log(`  ${index + 1}. ${game.title} (${game.nsuid})`);
          });
          break;
          
        case 'prices':
          console.log(`Game: ${result.game.title}`);
          console.log(`Found ${result.prices.length} real prices`);
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
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testRealOnlyScraper().catch(console.error);