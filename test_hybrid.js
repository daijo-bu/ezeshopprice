const { searchGame } = require('./src/eshopScraper_hybrid');

async function testHybridScraper() {
  console.log('Testing hybrid Nintendo eShop scraper...\n');
  
  const testGames = ['mario kart 8', 'zelda', 'pokemon'];
  
  for (const gameName of testGames) {
    console.log(`\n=== Testing: ${gameName} ===`);
    
    try {
      const startTime = Date.now();
      const prices = await searchGame(gameName);
      const endTime = Date.now();
      
      console.log(`Search completed in ${endTime - startTime}ms`);
      console.log(`Found ${prices.length} prices`);
      
      if (prices.length > 0) {
        console.log('\nTop 5 cheapest:');
        prices.slice(0, 5).forEach((price, index) => {
          const icons = (price.difficult ? ' 🔸' : '') + (price.giftCards ? ' 🎁' : '');
          console.log(`${index + 1}. ${price.region}${icons}: S$${price.sgdPrice.toFixed(2)} (${price.originalPrice.toFixed(2)} ${price.currency})`);
        });
      }
      
    } catch (error) {
      console.error(`Error testing ${gameName}:`, error.message);
    }
  }
}

testHybridScraper();