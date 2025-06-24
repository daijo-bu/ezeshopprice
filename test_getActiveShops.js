const { getActiveShops } = require('nintendo-switch-eshop');

async function testGetActiveShops() {
    console.log('🔍 Testing getActiveShops() to understand its return structure...\n');
    
    try {
        const activeShops = await getActiveShops();
        
        console.log(`✅ getActiveShops() returned ${activeShops.length} shops\n`);
        
        // Show first few shops to understand structure
        console.log('📊 First 5 shops structure:');
        activeShops.slice(0, 5).forEach((shop, index) => {
            console.log(`${index + 1}. ${JSON.stringify(shop, null, 2)}`);
        });
        
        console.log(`\n🌍 All available region codes: ${activeShops.map(s => s.code).join(', ')}`);
        
        // Check if any Asian countries are present
        const asianCodes = ['HK', 'SG', 'KR', 'TW', 'TH', 'MY', 'JP'];
        const foundAsian = activeShops.filter(shop => asianCodes.includes(shop.code));
        
        console.log(`\n🌏 Asian regions found: ${foundAsian.length}`);
        if (foundAsian.length > 0) {
            foundAsian.forEach(shop => {
                console.log(`  - ${shop.code}: ${shop.country} (Region: ${shop.region})`);
            });
        }
        
        // Show regions distribution
        const regionCounts = {};
        activeShops.forEach(shop => {
            regionCounts[shop.region] = (regionCounts[shop.region] || 0) + 1;
        });
        
        console.log('\n📈 Region distribution:');
        Object.entries(regionCounts).forEach(([region, count]) => {
            console.log(`  Region ${region}: ${count} shops`);
        });
        
        // Return structure for analysis
        return {
            totalShops: activeShops.length,
            shops: activeShops,
            asianShops: foundAsian,
            regionDistribution: regionCounts
        };
        
    } catch (error) {
        console.error(`❌ Error calling getActiveShops(): ${error.message}`);
        return null;
    }
}

// Run the test
testGetActiveShops()
    .then(result => {
        if (result) {
            console.log('\n🎯 Analysis complete!');
            console.log(`Total shops: ${result.totalShops}`);
            console.log(`Asian shops: ${result.asianShops.length}`);
            console.log('This data can be used to replace the hardcoded ALL_NINTENDO_REGIONS object.');
        }
    })
    .catch(console.error);