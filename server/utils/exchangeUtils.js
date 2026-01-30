const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createLimiter = (minIntervalMs = 200) => {
    let lastCall = 0;

    return {
        waitIfNeeded: async () => {
            const now = Date.now();
            const wait = Math.max(0, minIntervalMs - (now - lastCall));
            if (wait > 0) {
                await sleep(wait);
            }
            lastCall = Date.now();
        }
    };
};

const normalizeSymbol = (symbol = '') => {
    return symbol
        .toString()
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
};

const createTradingPair = (symbol, quote = 'USDT') => {
    const base = normalizeSymbol(symbol);
    const q = normalizeSymbol(quote);
    return `${base}${q}`;
};

const cacheMap = new Map();

const priceCache = {
    listeners: {},
    get: (symbol) => {
        const key = normalizeSymbol(symbol);
        return cacheMap.get(key);
    },
    set: (symbol, price, source = 'unknown') => {
        const key = normalizeSymbol(symbol);
        const entry = {
            price,
            source,
            timestamp: Date.now()
        };
        cacheMap.set(key, entry);

        if (priceCache.listeners[key]) {
            priceCache.listeners[key].forEach((callback) => callback(entry));
        }

        return entry;
    },
    delete: (symbol) => {
        const key = normalizeSymbol(symbol);
        return cacheMap.delete(key);
    },
    clear: () => {
        cacheMap.clear();
    }
};

const binanceLimiter = createLimiter(100);
const coinbaseLimiter = createLimiter(200);

module.exports = {
    binanceLimiter,
    coinbaseLimiter,
    normalizeSymbol,
    createTradingPair,
    priceCache
};
