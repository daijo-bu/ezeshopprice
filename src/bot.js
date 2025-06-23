const TelegramBot = require('node-telegram-bot-api');
const { searchGames, searchGameByNSUID } = require('./eshopScraper');
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
      
      // Wait a bit after clearing webhook
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Clear any pending updates to avoid conflicts
    console.log('📨 Clearing pending updates...');
    try {
      await bot.getUpdates({ offset: -1 });
      console.log('✅ Pending updates cleared');
    } catch (updateError) {
      console.log('⚠️ Could not clear updates:', updateError.message);
    }
    
    console.log('✅ Bot initialization complete, polling started');
    
  } catch (error) {
    console.error('❌ Bot initialization failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.statusCode);
      console.error('Response body:', error.response.body);
    }
    
    // If it's a 409 conflict, wait and retry once
    if (error.response?.statusCode === 409) {
      console.log('🔄 409 Conflict detected, waiting 30 seconds and retrying...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      try {
        await bot.deleteWebHook();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await bot.getUpdates({ offset: -1 });
        console.log('✅ Retry successful, bot should be ready now');
        return;
      } catch (retryError) {
        console.error('❌ Retry failed:', retryError.message);
      }
    }
    
    process.exit(1);
  }
}

// Add a startup delay to avoid conflicts with previous deployments
console.log('⏳ Starting bot in 5 seconds to avoid conflicts...');
setTimeout(() => {
  initializeBot();
}, 5000);

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.code, error.message);
  
  if (error.response) {
    console.error('Response status:', error.response.statusCode);
    console.error('Response body:', error.response.body);
    
    // Handle specific Telegram API errors
    if (error.response.body && error.response.body.error_code === 409) {
      console.error('🚨 CONFLICT: Another bot instance is running!');
      console.error('This usually means:');
      console.error('1. Multiple Railway deployments are active');
      console.error('2. Local bot is still running');
      console.error('3. Previous deployment didn\'t stop properly');
      console.error('');
      console.error('💡 Solutions:');
      console.error('- Stop any local bot instances');
      console.error('- Check Railway deployments tab');
      console.error('- Wait 1-2 minutes and restart');
      
      // Try to recover after a delay
      setTimeout(async () => {
        console.log('🔄 Attempting to recover from 409 conflict...');
        try {
          // Stop current polling
          await bot.stopPolling();
          console.log('⏹️ Polling stopped');
          
          // Clear webhook and updates
          await bot.deleteWebHook();
          console.log('🧹 Webhook cleared');
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Clear pending updates
          await bot.getUpdates({ offset: -1 });
          console.log('📨 Updates cleared');
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Restart polling
          await bot.startPolling();
          console.log('✅ Polling restarted successfully');
          
        } catch (err) {
          console.error('❌ Failed to recover from conflict:', err.message);
          console.log('💀 Exiting to let Railway restart the container...');
          process.exit(1);
        }
      }, 15000);
    }
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
  
  const searchingMessage = await bot.sendMessage(chatId, `🔍 Searching Nintendo eShop for "${gameName}"...\n⏳ Finding real prices only.`);
  
  try {
    const result = await searchGames(gameName);
    
    await bot.deleteMessage(chatId, searchingMessage.message_id).catch(() => {});
    
    switch (result.type) {
      case 'no_results':
        bot.sendMessage(chatId, `❌ ${result.message}\n\n💡 Try:\n• Using the exact game title\n• Checking spelling\n• Using fewer words\n\nExample: /price "Mario Kart 8"`);
        break;
        
      case 'no_prices':
        bot.sendMessage(chatId, `🎮 *${result.game.title}*\n\n❌ ${result.message}`, { parse_mode: 'Markdown' });
        break;
        
      case 'multiple_options':
        await sendGameSelectionMessage(chatId, result);
        break;
        
      case 'prices':
        const message = formatPricesMessage(result.game.title, result.prices);
        
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
        break;
        
      case 'error':
        bot.sendMessage(chatId, `❌ ${result.message}`);
        break;
        
      default:
        bot.sendMessage(chatId, '❌ Unexpected error occurred. Please try again.');
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

async function sendGameSelectionMessage(chatId, result) {
  let message = `${result.message}\n\n`;
  
  const inlineKeyboard = result.games.map((game, index) => [{
    text: `${index + 1}. ${game.title}`,
    callback_data: `game_${game.nsuid}`
  }]);
  
  // Add a cancel option
  inlineKeyboard.push([{
    text: '❌ Cancel',
    callback_data: 'cancel_selection'
  }]);
  
  result.games.forEach((game, index) => {
    message += `${index + 1}. *${game.title}*\n`;
    if (game.developer) message += `   Developer: ${game.developer}\n`;
    if (game.publisher) message += `   Publisher: ${game.publisher}\n`;
    message += '\n';
  });
  
  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: inlineKeyboard
    }
  });
}

// Handle callback queries for game selection
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  if (data === 'cancel_selection') {
    await bot.editMessageText('❌ Game selection cancelled.', {
      chat_id: chatId,
      message_id: messageId
    });
    await bot.answerCallbackQuery(callbackQuery.id);
    return;
  }
  
  if (data.startsWith('game_')) {
    const nsuid = data.replace('game_', '');
    
    await bot.editMessageText('🔍 Getting prices for selected game...', {
      chat_id: chatId,
      message_id: messageId
    });
    
    try {
      const result = await searchGameByNSUID(nsuid);
      
      switch (result.type) {
        case 'no_prices':
          await bot.editMessageText(`🎮 *${result.game.title}*\n\n❌ ${result.message}`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          });
          break;
          
        case 'prices':
          await bot.deleteMessage(chatId, messageId).catch(() => {});
          
          const message = formatPricesMessage(result.game.title, result.prices);
          
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
          break;
          
        case 'error':
          await bot.editMessageText(`❌ ${result.message}`, {
            chat_id: chatId,
            message_id: messageId
          });
          break;
      }
      
    } catch (error) {
      console.error('Error getting game prices:', error);
      await bot.editMessageText('❌ Error getting game prices. Please try again.', {
        chat_id: chatId,
        message_id: messageId
      });
    }
  }
  
  await bot.answerCallbackQuery(callbackQuery.id);
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

async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  
  try {
    // Stop the HTTP server
    await new Promise((resolve) => {
      server.close(resolve);
    });
    console.log('HTTP server stopped');
    
    // Stop bot polling
    await bot.stopPolling();
    console.log('Bot polling stopped');
    
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

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

// Add a simple HTTP server for Railway health checks
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      bot: 'running',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Nintendo eShop Price Bot is running! 🎮');
  }
});

server.listen(port, () => {
  console.log(`🌐 HTTP server listening on port ${port}`);
});

const instanceId = Math.random().toString(36).substr(2, 9);
console.log('🤖 Nintendo eShop Price Bot is running...');
console.log(`🆔 Instance ID: ${instanceId}`);
console.log('🔍 Ready to search for game prices across all regions!');