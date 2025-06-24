function formatPricesMessage(gameName, prices) {
  if (prices.length === 0) {
    return `No prices found for "${gameName}".`;
  }

  let message = `🎮 *${gameName}*\n`;
  message += `📊 Top ${Math.min(prices.length, 25)} cheapest regions:\n\n`;

  const bestPrice = prices[0];
  const bestRegionIcons = getRegionIcons(bestPrice);
  message += `🏆 *Best Deal: ${bestPrice.region}*${bestRegionIcons}\n`;
  message += `💰 S$${bestPrice.sgdPrice.toFixed(2)} (${bestPrice.originalPrice.toFixed(2)} ${bestPrice.currency})\n`;
  
  if (bestPrice.discount > 0) {
    message += `🔥 ${bestPrice.discount}% OFF\n`;
  }
  message += `\n`;

  message += `📋 *All Prices:*\n`;
  
  prices.forEach((price, index) => {
    const position = index + 1;
    const flag = getRegionFlag(price.regionCode);
    const regionIcons = getRegionIcons(price);
    const discountText = price.discount > 0 ? ` (-${price.discount}%)` : '';
    
    message += `${position}. ${flag} ${price.region}${regionIcons}\n`;
    message += `   S$${price.sgdPrice.toFixed(2)} (${price.originalPrice.toFixed(2)} ${price.currency})${discountText}\n`;
  });

  message += `\n💡 *Tip:* Prices are converted to SGD and sorted by cheapest first.`;
  message += `\n🔸 = Difficult to purchase from outside region`;
  message += `\n🎁 = Gift cards available (often discounted)`;
  message += `\n🌍 *Coverage:* ${prices.length} regions with pricing data available`;
  message += `\n📊 Data from eshop-prices.com`;

  return message;
}

function getRegionIcons(price) {
  let icons = '';
  
  // Add difficulty icon if region is difficult to purchase from
  if (price.difficult) {
    icons += ' 🔸';
  }
  
  // Add gift card icon if gift cards are available
  if (price.giftCards) {
    icons += ' 🎁';
  }
  
  return icons;
}

function getRegionFlag(regionCode) {
  const flags = {
    // Americas
    'US': '🇺🇸', 'CA': '🇨🇦', 'MX': '🇲🇽', 'BR': '🇧🇷', 'AR': '🇦🇷', 'CL': '🇨🇱', 'PE': '🇵🇪', 'CO': '🇨🇴',
    
    // Europe & Oceania
    'GB': '🇬🇧', 'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'IT': '🇮🇹', 'NL': '🇳🇱', 'BE': '🇧🇪', 'CH': '🇨🇭', 'AT': '🇦🇹', 'PT': '🇵🇹', 'IE': '🇮🇪', 'LU': '🇱🇺',
    'CZ': '🇨🇿', 'DK': '🇩🇰', 'FI': '🇫🇮', 'GR': '🇬🇷', 'HU': '🇭🇺', 'NO': '🇳🇴', 'PL': '🇵🇱', 'SE': '🇸🇪', 'SK': '🇸🇰', 'SI': '🇸🇮', 'HR': '🇭🇷', 'BG': '🇧🇬', 'RO': '🇷🇴', 'EE': '🇪🇪', 'LV': '🇱🇻', 'LT': '🇱🇹', 'CY': '🇨🇾', 'MT': '🇲🇹', 'RU': '🇷🇺',
    
    // Other regions
    'AU': '🇦🇺', 'NZ': '🇳🇿', 'ZA': '🇿🇦',
    
    // Asia (Japan and Hong Kong have official eShops)
    'JP': '🇯🇵', 'HK': '🇭🇰'
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
  getRegionIcons,
  formatCurrency,
  sanitizeGameName,
  validateGameName
};