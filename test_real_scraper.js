const { searchGame } = require('./src/eshopScraper_real');

async function testRealScraper() {
  console.log('Testing real Nintendo eShop scraper...\n');
  
  const testGames = [
    'Mario Kart 8',
    'Zelda Breath',
    'Super Mario Odyssey',
    'Pokemon Scarlet'
  ];
  
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
      } else {
        console.log('No prices found');
      }
      
    } catch (error) {
      console.error(`Error testing ${gameName}:`, error.message);
    }
    
    // Wait between tests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

testRealScraper().catch(console.error);