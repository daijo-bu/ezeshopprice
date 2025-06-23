# Claude Instructions: Nintendo eShop Price Telegram Bot

## Project Overview
You are working on a Nintendo eShop Price Telegram Bot that scrapes game prices from 30+ regions and converts them to SGD for comparison. This mimics eshop-prices.com functionality through a Telegram interface.

## Core Architecture Understanding

### File Structure & Responsibilities
- `src/bot.js` - Main Telegram bot with command handlers, input validation, error handling
- `src/eshopScraper.js` - Multi-region price scraping with fallback mechanisms  
- `src/currencyConverter.js` - SGD conversion with 30min caching and fallback rates
- `src/utils.js` - Message formatting, validation, region flags, utility functions

### Key Features Implemented
- ✅ Multi-region scraping (Americas, Europe, Asia-Pacific)
- ✅ Real-time currency conversion to SGD
- ✅ Input validation and comprehensive error handling
- ✅ Professional message formatting with flags and progress indicators
- ✅ Rate limiting (100ms between requests) and graceful degradation

## Development Guidelines

### Code Patterns & Conventions
1. **Async/Await Pattern**: All scraping and API calls use async/await with proper error handling
2. **Fallback Strategy**: Primary scraping from Nintendo sites, fallback to eshop-prices.com
3. **Caching**: 30-minute cache for exchange rates to reduce API calls
4. **Input Sanitization**: Always validate and sanitize user input through `validateGameName()` and `sanitizeGameName()`
5. **Progress Feedback**: Show search progress to users with deletable status messages

### Error Handling Standards
- Network errors (ENOTFOUND) → User-friendly network messages
- Rate limiting (429) → Ask user to wait before retry
- Generic errors → Log details, show generic user message
- Always delete progress messages after completion/error

### Message Formatting Rules
- Use Markdown formatting for structure and emphasis
- Include region flags from `getRegionFlag()` function
- Split long messages using `splitMessage()` for Telegram limits
- Show SGD prices with 2 decimal places
- Display original currency and price alongside SGD conversion

## Common Tasks & Workflows

### Adding New Regions
1. Add region to `REGIONS` object in `eshopScraper.js` with code, currency, name
2. Add corresponding flag emoji to `getRegionFlag()` in `utils.js`
3. Test scraping for the new region
4. Update documentation with new region count

### Debugging Scraping Issues
1. Test individual region scraping using the test code snippet
2. Check if Nintendo regional site structure changed
3. Verify fallback to eshop-prices.com is working
4. Monitor rate limiting and adjust delays if needed

### Currency Conversion Problems
1. Check if exchangerate-api.com is accessible
2. Verify fallback rates are current and reasonable
3. Clear cache by restarting bot if rates seem stale
4. Add new currencies to fallback rates if missing

### Bot Command Issues
1. Test input validation with edge cases (empty, too long, special chars)
2. Verify message splitting works for very long responses
3. Check progress message deletion doesn't cause errors
4. Test all error handling paths

## Environment & Dependencies

### Required Environment Variables
- `TELEGRAM_BOT_TOKEN` - Required, from @BotFather
- `EXCHANGE_RATE_API_KEY` - Optional, has fallback rates

### Key Dependencies
- `node-telegram-bot-api` - Telegram bot interface
- `axios` - HTTP requests for scraping and currency APIs
- `cheerio` - HTML parsing for price extraction
- `dotenv` - Environment variable management

### Setup Commands
```bash
npm install                    # Install dependencies
cp .env.example .env          # Setup environment
npm start                     # Start bot
npm run dev                   # Development with nodemon
```

## Performance & Optimization

### Current Optimizations
- 100ms delays between region requests to avoid rate limiting
- 30-minute exchange rate caching
- Fallback exchange rates to reduce API dependency
- Message splitting to handle Telegram limits
- Graceful error handling with user feedback

### Monitoring Points
- Scraping success rate per region
- Currency conversion API availability
- Response times for price searches
- User error rates and common failure patterns

## Maintenance Guidelines

### Regular Tasks
- Monitor scraping success rates across regions
- Update fallback exchange rates monthly
- Check for Nintendo eShop site structure changes
- Verify bot token and API keys remain valid

### When Adding Features
1. Follow existing async/await error handling patterns
2. Add appropriate input validation
3. Include progress indicators for long operations
4. Test with edge cases and error conditions
5. Update help messages and documentation

### Code Quality Standards
- Use existing utility functions rather than duplicating logic
- Maintain consistent error message formatting
- Add logging for debugging without exposing sensitive data
- Follow the established caching patterns for external APIs

## Testing Approach

### Manual Testing
```javascript
// Test scraper independently
const { searchGame } = require('./src/eshopScraper');
searchGame('Mario Kart').then(console.log);

// Test currency conversion
const { convertToSGD } = require('./src/currencyConverter');
convertToSGD(59.99, 'USD').then(console.log);
```

### Bot Testing
- Test `/start`, `/help`, `/price` commands
- Verify input validation with invalid inputs
- Test long game names and special characters
- Check error handling with network disconnected

## Future Enhancement Guidelines

### Approved Enhancement Areas
- Game title fuzzy matching for better search results
- User favorites/watchlist functionality
- Price history tracking and alerts
- Web dashboard for monitoring bot performance

### Implementation Approach
- Maintain backward compatibility with existing commands
- Follow established patterns for new features
- Add comprehensive error handling for new functionality
- Update help messages and documentation accordingly