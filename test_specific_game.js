const { searchGames, searchGameByNSUID, getActiveShopsWithCache } = require('./src/eshopScraper');

async function testSpecificGame() {
  console.log('=== Testing Specific Game Pricing ===\n');
  
  // Test Mario Kart 8 Deluxe by NSUID (known to work)
  console.log('🎯 Testing Mario Kart 8 Deluxe by NSUID...');
  
  try {
    const result = await searchGameByNSUID('70010000000153');
    console.log(`Result type: ${result.type}`);
    
    if (result.type === 'prices') {
      console.log(`Game: ${result.game.title}`);
      console.log(`Found ${result.prices.length} prices:`);
      
      result.prices.slice(0, 10).forEach((price, index) => {
        const icons = (price.difficult ? ' 🔸' : '') + (price.giftCards ? ' 🎁' : '');
        console.log(`${index + 1}. ${price.region} (${price.regionCode})${icons}: S$${price.sgdPrice.toFixed(2)} (${price.originalPrice.toFixed(2)} ${price.currency})`);
      });
      
      // Regional analysis
      const uniqueRegions = [...new Set(result.prices.map(p => p.regionCode))];
      console.log(`\nPrices found in ${uniqueRegions.length} unique regions: ${uniqueRegions.join(', ')}`);
      
      const cheapest = result.prices[0];
      const mostExpensive = result.prices[result.prices.length - 1];
      console.log(`Cheapest: ${cheapest.region} at S$${cheapest.sgdPrice.toFixed(2)}`);
      console.log(`Most expensive: ${mostExpensive.region} at S$${mostExpensive.sgdPrice.toFixed(2)}`);
      console.log(`Price difference: S$${(mostExpensive.sgdPrice - cheapest.sgdPrice).toFixed(2)} (${(((mostExpensive.sgdPrice - cheapest.sgdPrice) / cheapest.sgdPrice) * 100).toFixed(1)}%)`);
      
    } else {
      console.log(`Result: ${result.message}`);
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

testSpecificGame().catch(console.error);