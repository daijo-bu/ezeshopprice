// Test the eshop-prices.com scraper
const { searchGameOnEshopPrices } = require('./src/eshopPricesScraper');

async function testEshopPricesScraper() {
  console.log('🧪 Testing eshop-prices.com scraper...\n');
  
  const testGames = [
    'Mario Kart 8',
    'Zelda Breath of the Wild',
    'Animal Crossing'
  ];
  
  for (const gameName of testGames) {
    console.log(`\n🔍 Testing search for: "${gameName}"`);
    console.log('=' + '='.repeat(50));
    
    try {
      const result = await searchGameOnEshopPrices(gameName);
      
      console.log(`Result type: ${result.type}`);
      
      if (result.type === 'prices') {
        console.log(`Game title: ${result.game.title}`);
        console.log(`Total prices found: ${result.prices.length}`);
        
        if (result.prices.length > 0) {
          console.log('\nTop 5 cheapest regions:');
          result.prices.slice(0, 5).forEach((price, index) => {
            console.log(`${index + 1}. ${price.region}: ${price.originalPrice} ${price.currency} = S$${price.sgdPrice.toFixed(2)}`);
          });
        }
      } else {
        console.log(`Message: ${result.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing "${gameName}":`, error.message);
    }
    
    console.log('\n' + '-'.repeat(60));
  }
}

if (require.main === module) {
  testEshopPricesScraper()
    .then(() => {
      console.log('\n✅ Test completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testEshopPricesScraper };