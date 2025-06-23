const axios = require('axios');

async function testPriceAPI() {
  console.log('Testing Nintendo Price API directly...\n');
  
  // Test with Mario Kart 8 Deluxe NSUID: 70010000000126
  const nsuid = '70010000000126';
  const regions = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'DE', name: 'Germany' },
    { code: 'JP', name: 'Japan' }
  ];
  
  for (const region of regions) {
    console.log(`=== Testing ${region.name} (${region.code}) ===`);
    
    try {
      const url = `https://api.ec.nintendo.com/v1/price?country=${region.code}&lang=en&ids=${nsuid}`;
      console.log(`URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000
      });
      
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      const priceInfo = response.data?.prices?.[0];
      if (priceInfo) {
        console.log('✅ Found price data!');
        console.log('Regular price:', priceInfo.regular_price);
        console.log('Discount price:', priceInfo.discount_price);
      } else {
        console.log('❌ No price data in response');
      }
      
    } catch (error) {
      console.log('❌ Error:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
      }
    }
    
    console.log();
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Also test a different approach - checking if there are alternative endpoints
  console.log('=== Testing alternative approaches ===');
  
  try {
    // Test DekuDeals as a potential data source
    console.log('Testing DekuDeals API...');
    const dekuResponse = await axios.get('https://www.dekudeals.com/api/price-history/70010000000126', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    console.log('DekuDeals response:', dekuResponse.status);
    console.log('DekuDeals data:', JSON.stringify(dekuResponse.data, null, 2));
    
  } catch (error) {
    console.log('DekuDeals error:', error.message);
  }
}

testPriceAPI().catch(console.error);