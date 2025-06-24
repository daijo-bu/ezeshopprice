const { getActiveShops } = require('nintendo-switch-eshop');

// Current hardcoded metadata for reference
const HARDCODED_METADATA = {
  'US': { difficult: false, giftCards: true },
  'CA': { difficult: false, giftCards: true },
  'MX': { difficult: true, giftCards: true },
  'BR': { difficult: true, giftCards: true },
  'AR': { difficult: true, giftCards: true },
  'CL': { difficult: true, giftCards: false },
  'CO': { difficult: true, giftCards: false },
  'PE': { difficult: true, giftCards: false },
  'GB': { difficult: false, giftCards: true },
  'DE': { difficult: false, giftCards: true },
  'FR': { difficult: false, giftCards: true },
  'IT': { difficult: false, giftCards: true },
  'ES': { difficult: false, giftCards: true },
  'NL': { difficult: false, giftCards: true },
  'BE': { difficult: false, giftCards: false },
  'CH': { difficult: true, giftCards: false },
  'AT': { difficult: false, giftCards: false },
  'PT': { difficult: false, giftCards: false },
  'IE': { difficult: false, giftCards: false },
  'LU': { difficult: false, giftCards: false },
  'CZ': { difficult: true, giftCards: false },
  'DK': { difficult: false, giftCards: false },
  'FI': { difficult: false, giftCards: false },
  'GR': { difficult: true, giftCards: false },
  'HU': { difficult: true, giftCards: false },
  'NO': { difficult: true, giftCards: false },
  'PL': { difficult: true, giftCards: false },
  'SE': { difficult: false, giftCards: false },
  'SK': { difficult: true, giftCards: false },
  'SI': { difficult: true, giftCards: false },
  'HR': { difficult: true, giftCards: false },
  'BG': { difficult: true, giftCards: false },
  'RO': { difficult: true, giftCards: false },
  'EE': { difficult: true, giftCards: false },
  'LV': { difficult: true, giftCards: false },
  'LT': { difficult: true, giftCards: false },
  'CY': { difficult: true, giftCards: false },
  'MT': { difficult: true, giftCards: false },
  'RU': { difficult: true, giftCards: true },
  'AU': { difficult: false, giftCards: true },
  'NZ': { difficult: false, giftCards: false },
  'ZA': { difficult: true, giftCards: true },
  'JP': { difficult: true, giftCards: true }
};

// Additional regions for direct API access (not available in getActiveShops)
const DIRECT_API_REGIONS = {
  'HK': { code: 'HK', currency: 'HKD', name: 'Hong Kong', difficult: true, giftCards: true, api: 'direct' },
  'SG': { code: 'SG', currency: 'SGD', name: 'Singapore', difficult: false, giftCards: false, api: 'direct' },
  'KR': { code: 'KR', currency: 'KRW', name: 'South Korea', difficult: true, giftCards: false, api: 'direct' },
  'TW': { code: 'TW', currency: 'TWD', name: 'Taiwan', difficult: true, giftCards: false, api: 'direct' },
  'TH': { code: 'TH', currency: 'THB', name: 'Thailand', difficult: true, giftCards: false, api: 'direct' },
  'MY': { code: 'MY', currency: 'MYR', name: 'Malaysia', difficult: true, giftCards: false, api: 'direct' }
};

async function createDynamicRegionsSystem() {
  console.log('🚀 Creating Dynamic Regions System Using getActiveShops()...\n');
  
  try {
    // Get dynamic regions from Nintendo's API
    const activeShops = await getActiveShops();
    console.log(`✅ Retrieved ${activeShops.length} active shops from Nintendo API`);
    
    // Transform getActiveShops() data into comprehensive regions format
    const dynamicRegions = {};
    
    activeShops.forEach(shop => {
      // Get metadata for this region (fallback to safe defaults)
      const metadata = HARDCODED_METADATA[shop.code] || { difficult: true, giftCards: false };
      
      // Create comprehensive region entry
      dynamicRegions[shop.code] = {
        code: shop.code,
        currency: shop.currency,
        name: shop.country,
        difficult: metadata.difficult,
        giftCards: metadata.giftCards,
        api: 'sales',
        region: shop.region,
        source: 'dynamic_api'
      };
    });
    
    // Add direct API regions (not available through getActiveShops)
    Object.assign(dynamicRegions, DIRECT_API_REGIONS);
    
    console.log(`🔧 Created dynamic regions system with ${Object.keys(dynamicRegions).length} total regions`);
    console.log(`   - ${activeShops.length} from Nintendo API (getActiveShops)`);
    console.log(`   - ${Object.keys(DIRECT_API_REGIONS).length} from direct API access`);
    
    // Analyze the differences
    console.log('\n📊 COMPARISON ANALYSIS:');
    
    const hardcodedKeys = Object.keys(HARDCODED_METADATA);
    const dynamicKeys = activeShops.map(s => s.code);
    
    // Missing from dynamic (regions in hardcoded but not in getActiveShops)
    const missingInDynamic = hardcodedKeys.filter(code => !dynamicKeys.includes(code));
    console.log(`❌ Missing in dynamic API (${missingInDynamic.length}): ${missingInDynamic.join(', ')}`);
    
    // New in dynamic (regions in getActiveShops but not in hardcoded)
    const newInDynamic = dynamicKeys.filter(code => !hardcodedKeys.includes(code));
    console.log(`✅ New in dynamic API (${newInDynamic.length}): ${newInDynamic.join(', ')}`);
    
    // Perfect matches
    const matches = dynamicKeys.filter(code => hardcodedKeys.includes(code));
    console.log(`🎯 Perfect matches (${matches.length}): ${matches.join(', ')}`);
    
    // Show region distribution
    console.log('\n🌍 REGION DISTRIBUTION:');
    const regionStats = {};
    Object.values(dynamicRegions).forEach(region => {
      if (region.region !== undefined) {
        const regionName = getRegionName(region.region);
        regionStats[regionName] = (regionStats[regionName] || 0) + 1;
      }
    });
    
    Object.entries(regionStats).forEach(([region, count]) => {
      console.log(`   ${region}: ${count} shops`);
    });
    
    // Show API types
    console.log('\n🔌 API DISTRIBUTION:');
    const apiStats = {};
    Object.values(dynamicRegions).forEach(region => {
      apiStats[region.api] = (apiStats[region.api] || 0) + 1;
    });
    
    Object.entries(apiStats).forEach(([api, count]) => {
      console.log(`   ${api}: ${count} regions`);
    });
    
    console.log('\n🎯 INTEGRATION BENEFITS:');
    console.log('1. ✅ Always up-to-date: Uses Nintendo\'s live API data');
    console.log('2. ✅ Accurate region count: No manual maintenance needed');
    console.log('3. ✅ Currency precision: Exact currency codes from Nintendo');
    console.log('4. ✅ Official validation: Only officially supported regions');
    console.log('5. ✅ Future-proof: Automatically includes new regions');
    console.log('6. ✅ Enhanced coverage: Combines API data with direct access');
    
    return {
      dynamicRegions,
      statistics: {
        totalRegions: Object.keys(dynamicRegions).length,
        apiRegions: activeShops.length,
        directRegions: Object.keys(DIRECT_API_REGIONS).length,
        missingInDynamic,
        newInDynamic,
        matches
      }
    };
    
  } catch (error) {
    console.error(`❌ Error creating dynamic regions system: ${error.message}`);
    return null;
  }
}

function getRegionName(regionId) {
  switch (regionId) {
    case 1: return 'Americas';
    case 2: return 'Europe & Oceania';
    case 3: return 'Asia';
    default: return 'Direct API';
  }
}

// Show how to use this in the existing codebase
function demonstrateIntegration(dynamicRegions) {
  console.log('\n🔧 INTEGRATION EXAMPLE:');
  console.log('Replace this in comprehensiveRegions.js:');
  console.log('```javascript');
  console.log('// OLD: Hardcoded static regions');
  console.log('const ALL_NINTENDO_REGIONS = {');
  console.log('  "US": { code: "US", currency: "USD", ... },');
  console.log('  "CA": { code: "CA", currency: "CAD", ... },');
  console.log('  // ... 43+ hardcoded entries');
  console.log('};');
  console.log('');
  console.log('// NEW: Dynamic regions from Nintendo API');
  console.log('const { getActiveShops } = require("nintendo-switch-eshop");');
  console.log('const dynamicRegions = await createDynamicRegionsSystem();');
  console.log('const ALL_NINTENDO_REGIONS = dynamicRegions;');
  console.log('```');
  
  console.log('\n🎯 Example dynamic region entry:');
  const exampleRegion = Object.values(dynamicRegions)[0];
  console.log(JSON.stringify(exampleRegion, null, 2));
}

// Run the test
createDynamicRegionsSystem()
  .then(result => {
    if (result) {
      console.log('\n✅ Dynamic regions system created successfully!');
      demonstrateIntegration(result.dynamicRegions);
      
      console.log('\n📋 NEXT STEPS:');
      console.log('1. Replace hardcoded ALL_NINTENDO_REGIONS with this dynamic system');
      console.log('2. Update caching strategy to refresh every hour');
      console.log('3. Implement fallback mechanism for API failures');
      console.log('4. Test comprehensive pricing with new dynamic regions');
      console.log('5. Update documentation to reflect dynamic nature');
    }
  })
  .catch(console.error);