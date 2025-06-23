const PriceCache = require('./priceCache');

class PriceUpdater {
  constructor() {
    this.cache = new PriceCache();
    this.isRunning = false;
    this.updateInterval = null;
  }

  async start() {
    console.log('[UPDATER] Starting price update service...');
    
    // Initialize cache
    await this.cache.initialize();
    
    // Do initial update if cache is empty or very old
    const shouldUpdateGames = this.cache.games.size < 100;
    const shouldUpdatePrices = !this.cache.lastUpdated || 
      (Date.now() - this.cache.lastUpdated.getTime()) > (60 * 60 * 1000); // 1 hour old
    
    if (shouldUpdateGames) {
      console.log('[UPDATER] Cache is empty, performing initial game database scan...');
      await this.cache.updateGameDatabase();
    }
    
    if (shouldUpdatePrices) {
      console.log('[UPDATER] Cache is stale, performing initial price update...');
      await this.cache.updatePrices();
    }
    
    // Start periodic updates every 15 minutes
    this.isRunning = true;
    this.updateInterval = setInterval(() => {
      this.performPeriodicUpdate();
    }, 15 * 60 * 1000); // 15 minutes
    
    console.log('[UPDATER] Price update service started. Will update every 15 minutes.');
  }

  async stop() {
    console.log('[UPDATER] Stopping price update service...');
    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    console.log('[UPDATER] Price update service stopped.');
  }

  async performPeriodicUpdate() {
    if (!this.isRunning) return;
    
    console.log('[UPDATER] Starting periodic price update...');
    
    try {
      // Update prices for all known games
      await this.cache.updatePrices();
      
      // Once per day (every 96 intervals), update the game database
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() < 15) { // Around 2 AM
        console.log('[UPDATER] Performing daily game database update...');
        await this.cache.updateGameDatabase();
      }
      
    } catch (error) {
      console.error('[UPDATER] Error during periodic update:', error.message);
    }
  }

  // Get the cache instance for use by the bot
  getCache() {
    return this.cache;
  }

  // Manual trigger functions for testing
  async triggerGameUpdate() {
    console.log('[UPDATER] Manual trigger: Updating game database...');
    await this.cache.updateGameDatabase();
  }

  async triggerPriceUpdate() {
    console.log('[UPDATER] Manual trigger: Updating prices...');
    await this.cache.updatePrices();
  }
}

// If this file is run directly, start the service
if (require.main === module) {
  const updater = new PriceUpdater();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[UPDATER] Received SIGINT, shutting down gracefully...');
    await updater.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n[UPDATER] Received SIGTERM, shutting down gracefully...');
    await updater.stop();
    process.exit(0);
  });
  
  // Start the service
  updater.start().catch(error => {
    console.error('[UPDATER] Failed to start:', error);
    process.exit(1);
  });
}

module.exports = PriceUpdater;