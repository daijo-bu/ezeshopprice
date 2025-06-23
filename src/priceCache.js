const fs = require('fs').promises;
const path = require('path');
const { 
  getQueriedGamesAmerica,
  getGamesEurope,
  getGamesJapan,
  getPrices
} = require('nintendo-switch-eshop');
const { convertToSGD } = require('./currencyConverter');
const { REGIONS } = require('./eshopScraper');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const GAMES_CACHE_FILE = path.join(CACHE_DIR, 'games.json');
const PRICES_CACHE_FILE = path.join(CACHE_DIR, 'prices.json');

class PriceCache {
  constructor() {
    this.games = new Map();
    this.prices = new Map();
    this.lastUpdated = null;
  }

  async initialize() {
    // Ensure cache directory exists
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      console.log('[CACHE] Cache directory already exists');
    }

    // Load existing caches
    await this.loadGamesCache();
    await this.loadPricesCache();

    console.log(`[CACHE] Initialized with ${this.games.size} games and pricing for ${this.prices.size} NSUIDs`);
  }

  async loadGamesCache() {
    try {
      const data = await fs.readFile(GAMES_CACHE_FILE, 'utf8');
      const gamesData = JSON.parse(data);
      
      gamesData.games.forEach(game => {
        this.games.set(game.title.toLowerCase(), game);
      });
      
      console.log(`[CACHE] Loaded ${this.games.size} games from cache`);
    } catch (error) {
      console.log('[CACHE] No existing games cache found, starting fresh');
      this.games = new Map();
    }
  }

  async loadPricesCache() {
    try {
      const data = await fs.readFile(PRICES_CACHE_FILE, 'utf8');
      const pricesData = JSON.parse(data);
      
      Object.entries(pricesData.prices).forEach(([nsuid, priceData]) => {
        this.prices.set(nsuid, priceData);
      });
      
      this.lastUpdated = new Date(pricesData.lastUpdated);
      console.log(`[CACHE] Loaded prices for ${this.prices.size} NSUIDs, last updated: ${this.lastUpdated}`);
    } catch (error) {
      console.log('[CACHE] No existing prices cache found, starting fresh');
      this.prices = new Map();
      this.lastUpdated = null;
    }
  }

  async saveGamesCache() {
    const gamesData = {
      lastUpdated: new Date().toISOString(),
      games: Array.from(this.games.values())
    };

    await fs.writeFile(GAMES_CACHE_FILE, JSON.stringify(gamesData, null, 2));
    console.log(`[CACHE] Saved ${this.games.size} games to cache`);
  }

  async savePricesCache() {
    const pricesData = {
      lastUpdated: new Date().toISOString(),
      prices: Object.fromEntries(this.prices)
    };

    await fs.writeFile(PRICES_CACHE_FILE, JSON.stringify(pricesData, null, 2));
    console.log(`[CACHE] Saved prices for ${this.prices.size} NSUIDs to cache`);
  }

  // Search for a game in the cache
  searchGame(gameName) {
    const normalizedSearch = gameName.toLowerCase().trim();
    
    // Try exact match first
    let game = this.games.get(normalizedSearch);
    if (game) return game;

    // Try partial matches
    const matches = [];
    for (const [title, gameData] of this.games) {
      if (title.includes(normalizedSearch) || normalizedSearch.includes(title)) {
        matches.push({ game: gameData, score: this.calculateMatchScore(normalizedSearch, title) });
      }
    }

    // Return best match if score is good enough
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      if (matches[0].score > 500) {
        return matches[0].game;
      }
    }

    return null;
  }

  calculateMatchScore(searchTerm, title) {
    let score = 0;
    
    if (title === searchTerm) return 2000;
    if (title.startsWith(searchTerm)) score += 1500;
    if (title.includes(searchTerm)) score += 1000;

    const searchWords = searchTerm.split(' ').filter(w => w.length > 1);
    const titleWords = title.split(' ').filter(w => w.length > 1);

    searchWords.forEach(searchWord => {
      titleWords.forEach(titleWord => {
        if (searchWord === titleWord) score += 200;
        else if (titleWord.includes(searchWord)) score += 100;
      });
    });

    return score;
  }

  // Get cached prices for a game
  getCachedPrices(nsuid) {
    const priceData = this.prices.get(nsuid);
    if (!priceData) return null;

    // Check if prices are stale (older than 20 minutes)
    const lastUpdated = new Date(priceData.lastUpdated);
    const now = new Date();
    const minutesOld = (now - lastUpdated) / (1000 * 60);

    if (minutesOld > 20) {
      console.log(`[CACHE] Prices for NSUID ${nsuid} are ${minutesOld.toFixed(1)} minutes old, considering stale`);
      return null;
    }

    return priceData.regions;
  }

  // Update game database by scanning all regional libraries
  async updateGameDatabase() {
    console.log('[CACHE] Starting comprehensive game database update...');
    
    const startTime = Date.now();
    let totalGames = 0;

    try {
      // Scan Americas
      console.log('[CACHE] Scanning Americas library...');
      const americanGames = await getQueriedGamesAmerica('', { hitsPerPage: 500 });
      
      americanGames.forEach(game => {
        if (game.nsuid && game.nsuid !== 'MOBILE') {
          const existingGame = this.games.get(game.title.toLowerCase()) || {
            title: game.title,
            aliases: [game.title],
            nsuids: {},
            developers: [],
            publishers: []
          };

          existingGame.nsuids.americas = game.nsuid;
          if (game.developers?.[0]) existingGame.developers.push(game.developers[0]);
          if (game.publishers?.[0]) existingGame.publishers.push(game.publishers[0]);
          existingGame.lastUpdated = new Date().toISOString();

          this.games.set(game.title.toLowerCase(), existingGame);
          totalGames++;
        }
      });

      console.log(`[CACHE] Processed ${americanGames.length} American games`);

      // Scan Europe
      console.log('[CACHE] Scanning European library...');
      const europeanGames = await getGamesEurope({ limit: 1000 });
      
      europeanGames.forEach(game => {
        if (game.nsuid_txt?.[0]) {
          const existingGame = this.games.get(game.title.toLowerCase()) || {
            title: game.title,
            aliases: [game.title],
            nsuids: {},
            developers: [],
            publishers: []
          };

          existingGame.nsuids.europe = game.nsuid_txt[0];
          if (game.developer) existingGame.developers.push(game.developer);
          if (game.publisher) existingGame.publishers.push(game.publisher);
          existingGame.lastUpdated = new Date().toISOString();

          this.games.set(game.title.toLowerCase(), existingGame);
          totalGames++;
        }
      });

      console.log(`[CACHE] Processed ${europeanGames.length} European games`);

      // Scan Japan/Asia
      console.log('[CACHE] Scanning Japanese library...');
      const japaneseGames = await getGamesJapan();
      
      japaneseGames.forEach(game => {
        if (game.nsuid) {
          const existingGame = this.games.get(game.title.toLowerCase()) || {
            title: game.title,
            aliases: [game.title],
            nsuids: {},
            developers: [],
            publishers: []
          };

          existingGame.nsuids.asia = game.nsuid;
          if (game.developer) existingGame.developers.push(game.developer);
          if (game.publisher) existingGame.publishers.push(game.publisher);
          existingGame.lastUpdated = new Date().toISOString();

          this.games.set(game.title.toLowerCase(), existingGame);
          totalGames++;
        }
      });

      console.log(`[CACHE] Processed ${japaneseGames.length} Japanese games`);

      await this.saveGamesCache();
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`[CACHE] Game database update completed in ${duration.toFixed(1)}s. Total unique games: ${this.games.size}`);

    } catch (error) {
      console.error('[CACHE] Error updating game database:', error.message);
    }
  }

  // Update prices for all known games
  async updatePrices() {
    console.log('[CACHE] Starting price update for all known games...');
    
    const startTime = Date.now();
    let pricesUpdated = 0;
    
    // Get all unique NSUIDs
    const allNSUIDs = new Set();
    for (const game of this.games.values()) {
      Object.values(game.nsuids).forEach(nsuid => {
        if (nsuid) allNSUIDs.add(nsuid);
      });
    }

    console.log(`[CACHE] Updating prices for ${allNSUIDs.size} unique NSUIDs...`);

    for (const nsuid of allNSUIDs) {
      try {
        await this.updatePricesForNSUID(nsuid);
        pricesUpdated++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        if (pricesUpdated % 10 === 0) {
          console.log(`[CACHE] Updated prices for ${pricesUpdated}/${allNSUIDs.size} NSUIDs...`);
        }
      } catch (error) {
        console.error(`[CACHE] Error updating prices for NSUID ${nsuid}:`, error.message);
      }
    }

    await this.savePricesCache();
    
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[CACHE] Price update completed in ${duration.toFixed(1)}s. Updated ${pricesUpdated} NSUIDs.`);
  }

  async updatePricesForNSUID(nsuid) {
    const priceData = {
      lastUpdated: new Date().toISOString(),
      regions: {}
    };

    const allRegionCodes = Object.keys(REGIONS);
    
    const promises = allRegionCodes.map(async (regionCode) => {
      try {
        const priceResponse = await getPrices(regionCode, nsuid);
        const priceInfo = priceResponse.prices?.[0];
        
        if (priceInfo && priceInfo.sales_status === 'onsale' && priceInfo.regular_price?.raw_value) {
          const regularPrice = parseFloat(priceInfo.regular_price.raw_value);
          const discountPrice = priceInfo.discount_price ? parseFloat(priceInfo.discount_price.raw_value) : null;
          const finalPrice = discountPrice || regularPrice;
          
          if (finalPrice > 0) {
            const region = REGIONS[regionCode];
            const sgdPrice = await convertToSGD(finalPrice, region.currency);
            
            if (sgdPrice > 0) {
              priceData.regions[regionCode] = {
                price: finalPrice,
                currency: region.currency,
                sgdPrice: sgdPrice,
                discount: discountPrice ? Math.round((1 - discountPrice / regularPrice) * 100) : 0,
                difficult: region.difficult,
                giftCards: region.giftCards
              };
            }
          }
        }
      } catch (error) {
        // Silently fail for individual regions
      }
    });

    await Promise.allSettled(promises);
    
    if (Object.keys(priceData.regions).length > 0) {
      this.prices.set(nsuid, priceData);
    }
  }
}

module.exports = PriceCache;