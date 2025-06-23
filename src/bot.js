const TelegramBot = require('node-telegram-bot-api');
const { searchGame } = require('./eshopScraper_mock');
const { formatPricesMessage, validateGameName, sanitizeGameName } = require('./utils');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('📝 Please check your Railway environment variables');
  process.exit(1);
}

console.log('🔑 Bot token found, length:', token.length);
console.log('🔑 Token starts with:', token.substring(0, 10) + '...');

const bot = new TelegramBot(token, { 
  polling: {
    interval: 1000,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

console.log('🤖 TelegramBot instance created');

// Initialize bot with error handling
async function initializeBot() {
  try {
    // Test the bot token first
    const me = await bot.getMe();
    console.log('✅ Bot authenticated successfully:', me.username);
    
    // Check and clear any existing webhooks
    const webhookInfo = await bot.getWebHookInfo();
    console.log('🌐 Webhook info:', webhookInfo);
    
    if (webhookInfo.url) {
      console.log('⚠️  Webhook is set, removing it to enable polling...');
      await bot.deleteWebHook();
      console.log('✅ Webhook cleared');
    }
    
    console.log('✅ Bot initialization complete, polling started');
    
  } catch (error) {
    console.error('❌ Bot initialization failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.statusCode);
      console.error('Response body:', error.response.body);
    }
    process.exit(1);
  }
}

// Initialize the bot
initializeBot();

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.code, error.message);
  if (error.response) {
    console.error('Response status:', error.response.statusCode);
    console.error('Response body:', error.response.body);
  }
});

bot.on('error', (error) => {
  console.error('❌ Bot error:', error);
});

bot.on('message', (msg) => {
  console.log('📨 Received message:', {
    from: msg.from?.username || msg.from?.first_name,
    chat_id: msg.chat.id,
    text: msg.text,
    date: new Date(msg.date * 1000).toISOString()
  });
});

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
  console.log('Received SIGINT, shutting down bot gracefully...');
  bot.stopPolling().then(() => {
    console.log('Bot polling stopped');
    process.exit(0);
  }).catch(err => {
    console.error('Error stopping polling:', err);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down bot gracefully...');
  bot.stopPolling().then(() => {
    console.log('Bot polling stopped');
    process.exit(0);
  }).catch(err => {
    console.error('Error stopping polling:', err);
    process.exit(1);
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in environment variables');
  console.error('📝 Please create a .env file with your bot token');
  process.exit(1);
}

console.log('🤖 Nintendo eShop Price Bot is running...');
console.log('🔍 Ready to search for game prices across all regions!');