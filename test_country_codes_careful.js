const { getShopsByCountryCodes, getActiveShops, getPrices } = require('nintendo-switch-eshop');

// Helper function to add delay between requests
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCountryCodeAccessCarefully() {
    console.log('🔍 Testing getShopsByCountryCodes() carefully with delays...\n');
    
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
    
    console.log('📊 First, let\'s check what getActiveShops() shows:');
    console.log('(We already know from previous run that our target countries are not in active shops)');
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 Testing getShopsByCountryCodes() with careful delays...\n');
    
    const results = {
        accessible: [],
        errors: [],
        noData: []
    };
    
    // Test each country code individually with delays
    for (let i = 0; i < missingAsianCodes.length; i++) {
        const countryCode = missingAsianCodes[i];
        console.log(`\n🏳️ Testing ${countryCode} (${i + 1}/${missingAsianCodes.length}):`);
        
        // Test with Asia region first (most likely to work)
        for (let j = 0; j < regionIds.length; j++) {
            const region = regionIds[j];
            
            try {
                console.log(`  🔍 Trying ${countryCode} in ${region.name} (Region ${region.id})...`);
                
                // Add delay between requests to avoid rate limiting
                if (i > 0 || j > 0) {
                    console.log(`    ⏳ Waiting 3 seconds to avoid rate limit...`);
                    await delay(3000);
                }
                
                const shops = await getShopsByCountryCodes([countryCode], testNSUID, region.id);
                
                if (shops && shops.length > 0) {
                    console.log(`    ✅ SUCCESS! ${countryCode} accessible in ${region.name}`);
                    console.log(`    📊 Found ${shops.length} shop(s)`);
                    
                    // Log detailed shop information
                    shops.forEach((shop, index) => {
                        console.log(`    Shop ${index + 1}: ${JSON.stringify(shop, null, 6)}`);
                    });
                    
                    results.accessible.push({
                        country: countryCode,
                        region: region.name,
                        regionId: region.id,
                        shops: shops.length,
                        shopDetails: shops
                    });
                    
                    // Try to get prices if we have a valid shop code
                    if (shops[0] && (shops[0].code || shops[0].country)) {
                        const shopCode = shops[0].code || shops[0].country || countryCode;
                        console.log(`    💰 Attempting to get prices using shop code: ${shopCode}`);
                        
                        try {
                            await delay(2000); // Extra delay before price check
                            const prices = await getPrices(testNSUID, shopCode);
                            
                            if (prices && prices.length > 0) {
                                console.log(`    ✅ Price data available!`);
                                prices.forEach(price => {
                                    console.log(`      Game: ${price.title || 'Unknown'}`);
                                    console.log(`      Price: ${price.regular_price?.raw_value || 'N/A'} ${price.regular_price?.currency || ''}`);
                                    console.log(`      Sale: ${price.discount_price?.raw_value || 'No sale'}`);
                                });
                            } else {
                                console.log(`    ⚠️ No price data returned`);
                            }
                        } catch (priceError) {
                            console.log(`    ❌ Price check failed: ${priceError.message}`);
                        }
                    }
                    
                    // If we found success, we can break to avoid unnecessary requests
                    break;
                    
                } else {
                    console.log(`    ❌ No shops found in ${region.name}`);
                    results.noData.push({
                        country: countryCode,
                        region: region.name,
                        regionId: region.id
                    });
                }
                
            } catch (error) {
                console.log(`    ❌ Error in ${region.name}: ${error.message}`);
                results.errors.push({
                    country: countryCode,
                    region: region.name,
                    regionId: region.id,
                    error: error.message
                });
                
                // If we get a rate limit error, wait longer
                if (error.message.includes('Rate_Limit')) {
                    console.log(`    ⏳ Rate limit hit, waiting 10 seconds...`);
                    await delay(10000);
                }
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 FINAL RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n✅ BREAKTHROUGH DISCOVERIES:');
    if (results.accessible.length > 0) {
        console.log(`🎉 Found ${results.accessible.length} accessible country/region combinations!`);
        results.accessible.forEach(result => {
            console.log(`\n🌟 ${result.country} in ${result.region} (Region ${result.regionId})`);
            console.log(`   📊 Shops found: ${result.shops}`);
            console.log(`   🔍 Shop details: ${JSON.stringify(result.shopDetails, null, 4)}`);
        });
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Integrate these working country codes into the main bot');
        console.log('2. Update the eshop scraper to use these new regions');
        console.log('3. Test with more games to ensure consistency');
        console.log('4. Update the price comparison logic');
        
    } else {
        console.log('❌ No accessible combinations found');
    }
    
    console.log('\n🚫 ERRORS ENCOUNTERED:');
    if (results.errors.length > 0) {
        const errorsByType = {};
        results.errors.forEach(error => {
            if (!errorsByType[error.error]) {
                errorsByType[error.error] = [];
            }
            errorsByType[error.error].push(`${error.country} in ${error.region}`);
        });
        
        Object.keys(errorsByType).forEach(errorType => {
            console.log(`\n❌ ${errorType}:`);
            errorsByType[errorType].forEach(location => {
                console.log(`   ${location}`);
            });
        });
    } else {
        console.log('✅ No errors encountered!');
    }
    
    console.log('\n📊 SUMMARY STATISTICS:');
    console.log(`Total tests: ${results.accessible.length + results.errors.length + results.noData.length}`);
    console.log(`Successful: ${results.accessible.length}`);
    console.log(`Errors: ${results.errors.length}`);
    console.log(`No data: ${results.noData.length}`);
    
    // Comparison with getActiveShops()
    console.log('\n🔍 COMPARISON WITH getActiveShops():');
    console.log('getActiveShops() returned 43 active shops, but none of our target Asian countries were included.');
    console.log('This suggests that getShopsByCountryCodes() might be able to access regions that');
    console.log('are not considered "active" by the regular getActiveShops() function.');
    
    if (results.accessible.length > 0) {
        console.log('\n🎯 BREAKTHROUGH CONFIRMED!');
        console.log('We have successfully found a way to access previously inaccessible Asian regions!');
    }
}

// Run the test
console.log('🚀 Starting careful country code investigation...');
console.log('Target: Missing Asian regions via getShopsByCountryCodes()');
console.log('Game: Mario Kart 8 Deluxe (NSUID: 70010000000153)');
console.log('Countries: HK, SG, KR, TW, TH, MY');
console.log('Strategy: Careful with delays to avoid rate limits\n');

testCountryCodeAccessCarefully().catch(console.error);