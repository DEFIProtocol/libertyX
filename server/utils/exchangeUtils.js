// server/utils/exchangeUtils.js
const axios = require('axios');

// Rate limiting setup
class RateLimiter {
    constructor(requestsPerSecond = 10) {
        this.requestsPerSecond = requestsPerSecond;
        this.requestTimes = [];
    }

    async waitIfNeeded() {
        const now = Date.now();
        const windowStart = now - 1000; // 1 second window
        
        // Remove old requests
        this.requestTimes = this.requestTimes.filter(time => time > windowStart);
        
        // Check if we're at the limit
        if (this.requestTimes.length >= this.requestsPerSecond) {
            const oldestRequest = this.requestTimes[0];
            const waitTime = 1000 - (now - oldestRequest);
            
            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // Add this request
        this.requestTimes.push(Date.now());
    }
}

// Create rate limiters for each exchange
const binanceLimiter = new RateLimiter(10); // 10 requests per second
const coinbaseLimiter = new RateLimiter(3); // 3 requests per second (Coinbase is more strict)

// Helper to normalize symbols
const normalizeSymbol = (symbol) => {
    return symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

// Helper to create trading pairs
const createTradingPair = (symbol, baseCurrency = 'USDT') => {
    const normalized = normalizeSymbol(symbol);
    
    // Special cases for Binance
    if (baseCurrency === 'USDT') {
        const specialCases = {
            'BNB': 'BNBUSDT',
            'BTC': 'BTCUSDT',
            'ETH': 'ETHUSDT',
            'SOL': 'SOLUSDT',
            'ADA': 'ADAUSDT',
            'XRP': 'XRPUSDT',
            'DOT': 'DOTUSDT',
            'DOGE': 'DOGEUSDT',
            'AVAX': 'AVAXUSDT',
            'MATIC': 'MATICUSDT'
        };
        
        return specialCases[normalized] || `${normalized}${baseCurrency}`;
    }
    
    return `${normalized}${baseCurrency}`;
};

class PriceCache {
    constructor(ttl = 30000) {
        this.ttl = ttl;
        this.cache = new Map();
        this.listeners = {}; // ADDED: SSE support
    }

    set(symbol, price, source) {
        const data = {
            price,
            source,
            timestamp: Date.now()
        };
        
        this.cache.set(symbol, data);
        
        // ADDED: Broadcast to SSE listeners
        if (this.listeners[symbol]) {
            this.listeners[symbol].forEach(callback => {
                try {
                    callback(symbol, price, source);
                } catch (error) {
                    console.error(`Price update callback error for ${symbol}:`, error);
                }
            });
        }
    }

    get(symbol) {
        const cached = this.cache.get(symbol);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.ttl) {
            this.cache.delete(symbol);
            return null;
        }
        
        return cached;
    }

    clear() {
        this.cache.clear();
        this.listeners = {};
    }

    get size() {
        return this.cache.size;
    }

    get entries() {
        return this.cache.entries();
    }
}

// Create singleton instance
const priceCacheInstance = new PriceCache();

module.exports = {
    binanceLimiter,
    coinbaseLimiter,
    normalizeSymbol,
    createTradingPair,
    priceCache: priceCacheInstance,
    RateLimiter,
    PriceCache
};