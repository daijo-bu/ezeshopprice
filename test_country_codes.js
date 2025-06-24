const { getShopsByCountryCodes, getActiveShops, getPrices } = require('nintendo-switch-eshop');

async function testCountryCodeAccess() {
    console.log('🔍 Testing getShopsByCountryCodes() for missing Asian regions...\n');
    
    // Popular game NSUID for testing - Mario Kart 8 Deluxe
    const testNSUID = '70010000000153';
    
    // Missing Asian country codes to test
    const missingAsianCodes = ['HK', 'SG', 'KR', 'TW', 'TH', 'MY'];
    
    // Region IDs to test
    const regionIds = [
        { id: 1, name: 'Americas' },
        { id: 2, name: 'Europe' },
        { id: 3, name: 'Asia' }
    ];
    
    console.log('📊 First, let\'s see what getActiveShops() returns:');
    try {
        const activeShops = await getActiveShops();
        console.log(`Found ${activeShops.length} active shops:`);
        activeShops.forEach(shop => {
            console.log(`  ${shop.code} - ${shop.country} (Region: ${shop.region})`);
        });
        
        // Check if any of our target countries are in active shops
        const foundTargets = activeShops.filter(shop => 
            missingAsianCodes.includes(shop.code)
        );
        
        if (foundTargets.length > 0) {
            console.log('\n✅ Found some target countries in active shops:');
            foundTargets.forEach(shop => {
                console.log(`  ${shop.code} - ${shop.country}`);
            });
        } else {
            console.log('\n❌ None of our target Asian countries found in active shops');
        }
        
    } catch (error) {
        console.error('❌ Error getting active shops:', error.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 Now testing getShopsByCountryCodes()...\n');
    
    // Test each region with our target country codes
    for (const region of regionIds) {
        console.log(`\n🌍 Testing Region ${region.id} (${region.name}):`);
        console.log('-'.repeat(40));
        
        try {
            const shops = await getShopsByCountryCodes(missingAsianCodes, testNSUID, region.id);
            
            if (shops && shops.length > 0) {
                console.log(`✅ Found ${shops.length} shops in ${region.name}:`);
                shops.forEach(shop => {
                    console.log(`  Shop: ${JSON.stringify(shop, null, 2)}`);
                });
                
                // Try to get prices for found shops
                console.log('\n💰 Attempting to get prices...');
                try {
                    const prices = await getPrices(testNSUID, shops[0].code);
                    if (prices && prices.length > 0) {
                        console.log(`✅ Successfully got prices from ${shops[0].code}:`);
                        prices.forEach(price => {
                            console.log(`  Game: ${price.title}`);
                            console.log(`  Price: ${price.regular_price?.raw_value} ${price.regular_price?.currency}`);
                            console.log(`  Sale: ${price.discount_price?.raw_value || 'No sale'}`);
                        });
                    } else {
                        console.log('❌ No prices returned');
                    }
                } catch (priceError) {
                    console.log(`❌ Error getting prices: ${priceError.message}`);
                }
                
            } else {
                console.log(`❌ No shops found in ${region.name}`);
            }
            
        } catch (error) {
            console.log(`❌ Error testing ${region.name}: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Testing individual country codes...\n');
    
    // Test each country code individually
    for (const countryCode of missingAsianCodes) {
        console.log(`\n🏳️ Testing ${countryCode}:`);
        
        // Test with all regions
        for (const region of regionIds) {
            try {
                const shops = await getShopsByCountryCodes([countryCode], testNSUID, region.id);
                
                if (shops && shops.length > 0) {
                    console.log(`  ✅ ${countryCode} accessible in Region ${region.id} (${region.name})`);
                    console.log(`     Found ${shops.length} shop(s): ${shops.map(s => s.code || 'Unknown').join(', ')}`);
                    
                    // Try a quick price check
                    if (shops[0] && shops[0].code) {
                        try {
                            const quickPrices = await getPrices(testNSUID, shops[0].code);
                            if (quickPrices && quickPrices.length > 0) {
                                console.log(`     💸 Price available: ${quickPrices[0].regular_price?.raw_value} ${quickPrices[0].regular_price?.currency}`);
                            }
                        } catch (e) {
                            console.log(`     ⚠️ Price check failed: ${e.message}`);
                        }
                    }
                } else {
                    console.log(`  ❌ ${countryCode} not accessible in Region ${region.id} (${region.name})`);
                }
                
            } catch (error) {
                console.log(`  ❌ ${countryCode} error in Region ${region.id}: ${error.message}`);
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 SUMMARY REPORT');
    console.log('='.repeat(60));
    
    // Final comprehensive test
    console.log('\n🎯 Final comprehensive test with all combinations...');
    
    const results = {
        accessible: [],
        errors: [],
        noData: []
    };
    
    for (const countryCode of missingAsianCodes) {
        for (const region of regionIds) {
            try {
                const shops = await getShopsByCountryCodes([countryCode], testNSUID, region.id);
                
                if (shops && shops.length > 0) {
                    results.accessible.push({
                        country: countryCode,
                        region: region.name,
                        regionId: region.id,
                        shops: shops.length
                    });
                } else {
                    results.noData.push({
                        country: countryCode,
                        region: region.name,
                        regionId: region.id
                    });
                }
                
            } catch (error) {
                results.errors.push({
                    country: countryCode,
                    region: region.name,
                    regionId: region.id,
                    error: error.message
                });
            }
        }
    }
    
    console.log('\n✅ ACCESSIBLE COUNTRIES/REGIONS:');
    if (results.accessible.length > 0) {
        results.accessible.forEach(result => {
            console.log(`  ${result.country} in ${result.region} (Region ${result.regionId}) - ${result.shops} shop(s)`);
        });
    } else {
        console.log('  None found 😞');
    }
    
    console.log('\n❌ COUNTRIES WITH ERRORS:');
    if (results.errors.length > 0) {
        results.errors.forEach(result => {
            console.log(`  ${result.country} in ${result.region}: ${result.error}`);
        });
    } else {
        console.log('  No errors!');
    }
    
    console.log('\n⭕ COUNTRIES WITH NO DATA:');
    if (results.noData.length > 0) {
        results.noData.forEach(result => {
            console.log(`  ${result.country} in ${result.region}`);
        });
    } else {
        console.log('  All countries returned data!');
    }
    
    console.log('\n🎉 Investigation complete!');
    
    if (results.accessible.length > 0) {
        console.log('\n🚀 BREAKTHROUGH POTENTIAL:');
        console.log('We found accessible regions! This could be the key to accessing missing Asian markets.');
        console.log('Next steps: Integrate these findings into the main bot logic.');
    } else {
        console.log('\n🤔 No breakthrough yet, but we learned valuable information about the API limitations.');
    }
}

// Run the test
console.log('🚀 Starting comprehensive country code investigation...');
console.log('Target: Missing Asian regions via getShopsByCountryCodes()');
console.log('Game: Mario Kart 8 Deluxe (NSUID: 70010000000153)');
console.log('Countries: HK, SG, KR, TW, TH, MY');
console.log('Regions: 1 (Americas), 2 (Europe), 3 (Asia)\n');

testCountryCodeAccess().catch(console.error);