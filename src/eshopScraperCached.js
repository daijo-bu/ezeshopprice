const PriceCache = require('./priceCache');
const { searchGames: searchGamesOriginal, searchGameByNSUID: searchGameByNSUIDOriginal, REGIONS } = require('./eshopScraper');

class CachedEshopScraper {
  constructor() {
    this.cache = new PriceCache();
    this.initialized = false;
  }

  async initialize() {
    if (!this.initialized) {
      await this.cache.initialize();
      this.initialized = true;
      console.log('[CACHED-SCRAPER] Initialized with cache');
    }
  }

  async searchGames(gameName) {
    await this.initialize();
    
    console.log(`[CACHED-SCRAPER] Searching for: ${gameName}`);
    
    // Try to find game in cache first
    const cachedGame = this.cache.searchGame(gameName);
    
    if (cachedGame) {
      console.log(`[CACHED-SCRAPER] Found "${cachedGame.title}" in cache`);
      
      // Try to get cached prices for all NSUIDs of this game
      const allPrices = [];
      
      for (const [region, nsuid] of Object.entries(cachedGame.nsuids)) {
        if (!nsuid) continue;
        
        const cachedPrices = this.cache.getCachedPrices(nsuid);
        
        if (cachedPrices) {
          console.log(`[CACHED-SCRAPER] Using cached prices for ${region} NSUID ${nsuid}`);
          
          // Convert cached prices to our format
          Object.entries(cachedPrices).forEach(([regionCode, priceData]) => {
            if (REGIONS[regionCode]) {
              allPrices.push({
                region: REGIONS[regionCode].name,
                regionCode: regionCode,
                originalPrice: priceData.price,
                currency: priceData.currency,
                sgdPrice: priceData.sgdPrice,
                title: cachedGame.title,
                discount: priceData.discount || 0,
                difficult: priceData.difficult,
                giftCards: priceData.giftCards
              });
            }
          });
        } else {
          console.log(`[CACHED-SCRAPER] No cached prices for ${region} NSUID ${nsuid}, will fetch live`);
        }
      }
      
      if (allPrices.length > 0) {
        // Remove duplicates (same region from different NSUIDs)
        const uniquePrices = [];
        const seenRegions = new Set();
        
        allPrices
          .sort((a, b) => a.sgdPrice - b.sgdPrice) // Sort by price to keep cheapest
          .forEach(price => {
            if (!seenRegions.has(price.regionCode)) {
              uniquePrices.push(price);
              seenRegions.add(price.regionCode);
            }
          });
        
        console.log(`[CACHED-SCRAPER] Returning ${uniquePrices.length} cached prices for "${cachedGame.title}"`);
        
        return {
          type: 'prices',
          game: {
            title: cachedGame.title,
            nsuid: Object.values(cachedGame.nsuids)[0], // Use first available NSUID
            developer: cachedGame.developers?.[0] || 'Unknown',
            publisher: cachedGame.publishers?.[0] || 'Unknown'
          },
          prices: uniquePrices.sort((a, b) => a.sgdPrice - b.sgdPrice)
        };
      }
    }
    
    // Fall back to original search if not in cache or no cached prices
    console.log(`[CACHED-SCRAPER] No suitable cache data, falling back to live search`);
    return await searchGamesOriginal(gameName);
  }

  async searchGameByNSUID(nsuid) {
    await this.initialize();
    
    console.log(`[CACHED-SCRAPER] Searching by NSUID: ${nsuid}`);
    
    // Try to get cached prices first
    const cachedPrices = this.cache.getCachedPrices(nsuid);
    
    if (cachedPrices) {
      console.log(`[CACHED-SCRAPER] Found cached prices for NSUID ${nsuid}`);
      
      // Convert cached prices to our format
      const prices = [];
      Object.entries(cachedPrices).forEach(([regionCode, priceData]) => {
        if (REGIONS[regionCode]) {
          prices.push({
            region: REGIONS[regionCode].name,
            regionCode: regionCode,
            originalPrice: priceData.price,
            currency: priceData.currency,
            sgdPrice: priceData.sgdPrice,
            title: 'Cached Game', // Will be updated below
            discount: priceData.discount || 0,
            difficult: priceData.difficult,
            giftCards: priceData.giftCards
          });
        }
      });
      
      if (prices.length > 0) {
        // Try to find game title from cache
        let gameTitle = 'Selected Game';
        for (const game of this.cache.games.values()) {
          if (Object.values(game.nsuids).includes(nsuid)) {
            gameTitle = game.title;
            break;
          }
        }
        
        // Update title in all prices
        prices.forEach(price => price.title = gameTitle);
        
        console.log(`[CACHED-SCRAPER] Returning ${prices.length} cached prices for "${gameTitle}"`);
        
        return {
          type: 'prices',
          game: {
            title: gameTitle,
            nsuid: nsuid,
            developer: 'Unknown',
            publisher: 'Unknown'
          },
          prices: prices.sort((a, b) => a.sgdPrice - b.sgdPrice)
        };
      }
    }
    
    // Fall back to original search if not in cache
    console.log(`[CACHED-SCRAPER] No cached prices found, falling back to live search`);
    return await searchGameByNSUIDOriginal(nsuid);
  }

  // Get cache statistics for admin/debug purposes
  getCacheStats() {
    return {
      totalGames: this.cache.games.size,
      totalNSUIDs: this.cache.prices.size,
      lastUpdated: this.cache.lastUpdated,
      cacheHitRate: this.cache.hitCount / (this.cache.hitCount + this.cache.missCount) || 0
    };
  }
}

// Export singleton instance
const cachedScraper = new CachedEshopScraper();

module.exports = {
  searchGames: (gameName) => cachedScraper.searchGames(gameName),
  searchGameByNSUID: (nsuid) => cachedScraper.searchGameByNSUID(nsuid),
  getCacheStats: () => cachedScraper.getCacheStats(),
  REGIONS
};