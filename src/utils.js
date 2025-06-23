function formatPricesMessage(gameName, prices) {
  if (prices.length === 0) {
    return `No prices found for "${gameName}".`;
  }

  let message = `🎮 *${gameName}*\n`;
  message += `📊 Top ${Math.min(prices.length, 25)} cheapest regions:\n\n`;

  const bestPrice = prices[0];
  message += `🏆 *Best Deal: ${bestPrice.region}*\n`;
  message += `💰 S$${bestPrice.sgdPrice.toFixed(2)} (${bestPrice.originalPrice.toFixed(2)} ${bestPrice.currency})\n`;
  
  if (bestPrice.discount > 0) {
    message += `🔥 ${bestPrice.discount}% OFF\n`;
  }
  message += `\n`;

  message += `📋 *All Prices:*\n`;
  
  prices.forEach((price, index) => {
    const position = index + 1;
    const flag = getRegionFlag(price.regionCode);
    const discountText = price.discount > 0 ? ` (-${price.discount}%)` : '';
    
    message += `${position}. ${flag} ${price.region}\n`;
    message += `   S$${price.sgdPrice.toFixed(2)} (${price.originalPrice.toFixed(2)} ${price.currency})${discountText}\n`;
  });

  message += `\n💡 *Tip:* Prices are converted to SGD and sorted by cheapest first.`;
  message += `\n🕐 Data updated: ${new Date().toLocaleString('en-SG')}`;

  return message;
}

function getRegionFlag(regionCode) {
  const flags = {
    'US': '🇺🇸',
    'CA': '🇨🇦',
    'MX': '🇲🇽',
    'BR': '🇧🇷',
    'AR': '🇦🇷',
    'CL': '🇨🇱',
    'PE': '🇵🇪',
    'CO': '🇨🇴',
    'GB': '🇬🇧',
    'DE': '🇩🇪',
    'FR': '🇫🇷',
    'ES': '🇪🇸',
    'IT': '🇮🇹',
    'NL': '🇳🇱',
    'BE': '🇧🇪',
    'AT': '🇦🇹',
    'CH': '🇨🇭',
    'NO': '🇳🇴',
    'SE': '🇸🇪',
    'DK': '🇩🇰',
    'PL': '🇵🇱',
    'CZ': '🇨🇿',
    'HU': '🇭🇺',
    'JP': '🇯🇵',
    'KR': '🇰🇷',
    'HK': '🇭🇰',
    'TW': '🇹🇼',
    'SG': '🇸🇬',
    'MY': '🇲🇾',
    'TH': '🇹🇭',
    'AU': '🇦🇺',
    'NZ': '🇳🇿',
    'RU': '🇷🇺',
    'ZA': '🇿🇦'
  };
  
  return flags[regionCode] || '🌍';
}

function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function sanitizeGameName(gameName) {
  return gameName
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 100);
}

function validateGameName(gameName) {
  if (!gameName || typeof gameName !== 'string') {
    return false;
  }
  
  const sanitized = sanitizeGameName(gameName);
  return sanitized.length >= 2 && sanitized.length <= 100;
}

module.exports = {
  formatPricesMessage,
  getRegionFlag,
  formatCurrency,
  sanitizeGameName,
  validateGameName
};