const { searchGameInNintendoEurope, getNintendoPriceAPI } = require('./src/eshopScraper_real');
const axios = require('axios');

// Test single region price fetch
async function testSingleRegion() {
  console.log('Testing single region price fetch...\n');
  
  try {
    // First find Mario Kart 8 Deluxe
    console.log('1. Searching for Mario Kart 8...');
    
    const response = await axios.get('https://searching.nintendo-europe.com/en/select', {
      params: {
        q: 'Mario Kart 8',
        fq: 'type:GAME AND system_type:nintendoswitch*',
        rows: 5,
        start: 0,
        sort: 'popularity desc',
        wt: 'json'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    const games = response.data?.response?.docs || [];
    console.log('Found games:', games.map(g => ({ title: g.title, nsuid: g.nsuid_txt?.[0] })));
    
    if (games.length === 0) {
      console.log('No games found');
      return;
    }
    
    const game = games[0];
    const nsuid = game.nsuid_txt?.[0];
    
    console.log(`\n2. Testing price API for: ${game.title}`);
    console.log(`NSUID: ${nsuid}`);
    
    // Test US price
    console.log('\n3. Fetching US price...');
    const usResponse = await axios.get('https://api.ec.nintendo.com/v1/price', {
      params: {
        country: 'US',
        lang: 'en',
        ids: nsuid
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    
    console.log('US API Response:', JSON.stringify(usResponse.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testSingleRegion();