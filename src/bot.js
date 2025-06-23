const TelegramBot = require('node-telegram-bot-api');
const { searchGame } = require('./eshopScraper_mock');
const { formatPricesMessage, validateGameName, sanitizeGameName } = require('./utils');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `Welcome to Nintendo eShop Price Bot! 🎮

Use /price <game name> to get price comparison across regions.
Example: /price "The Legend of Zelda"

I'll show you the top 25 cheapest regions with prices converted to SGD.`;
  
  bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/price (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const rawGameName = match[1];
  
  if (!validateGameName(rawGameName)) {
    bot.sendMessage(chatId, '❌ Please provide a valid game name (2-100 characters).\nExample: /price "Mario Kart 8"');
    return;
  }
  
  const gameName = sanitizeGameName(rawGameName);
  
  const searchingMessage = await bot.sendMessage(chatId, `🔍 Searching for "${gameName}" across all regions...\n⏳ This may take up to 30 seconds.`);
  
  try {
    const prices = await searchGame(gameName);
    
    await bot.deleteMessage(chatId, searchingMessage.message_id).catch(() => {});
    
    if (prices.length === 0) {
      bot.sendMessage(chatId, `❌ No prices found for "${gameName}".\n\n💡 Try:\n• Using the exact game title\n• Checking spelling\n• Using fewer words\n\nExample: /price "Zelda Breath Wild"`);
      return;
    }
    
    const message = formatPricesMessage(gameName, prices);
    
    if (message.length > 4096) {
      const chunks = splitMessage(message, 4096);
      for (let i = 0; i < chunks.length; i++) {
        await bot.sendMessage(chatId, chunks[i], { parse_mode: 'Markdown' });
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } else {
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
    
  } catch (error) {
    console.error('Error searching for game:', error);
    
    await bot.deleteMessage(chatId, searchingMessage.message_id).catch(() => {});
    
    let errorMessage = '❌ Sorry, there was an error searching for the game.\n\n';
    
    if (error.code === 'ENOTFOUND') {
      errorMessage += '🌐 Network connection issue. Please try again in a moment.';
    } else if (error.response?.status === 429) {
      errorMessage += '⏰ Too many requests. Please wait a minute before trying again.';
    } else {
      errorMessage += '🔧 Technical issue occurred. Please try again later or contact support.';
    }
    
    bot.sendMessage(chatId, errorMessage);
  }
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `Nintendo eShop Price Bot Commands:

/start - Show welcome message
/price <game name> - Search for game prices
/help - Show this help message

Example: /price "Mario Kart 8"

The bot will show you the cheapest prices across different regions, converted to SGD.`;
  
  bot.sendMessage(chatId, helpMessage);
});

function splitMessage(message, maxLength) {
  const chunks = [];
  let currentChunk = '';
  const lines = message.split('\n');
  
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
    }
    currentChunk += line + '\n';
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

bot.on('error', (error) => {
  console.error('Bot error:', error);
});

process.on('SIGINT', () => {
  console.log('Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('📝 Please create a .env file with your bot token');
  process.exit(1);
}

console.log('🤖 Nintendo eShop Price Bot is running...');
console.log('🔍 Ready to search for game prices across all regions!');