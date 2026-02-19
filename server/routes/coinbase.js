// server/routes/coinbase.js
const express = require('express');
const router = express.Router();
const WebSocket = require('ws');
const crypto = require('crypto');
const axios = require('axios');
const { coinbaseLimiter, normalizeSymbol, priceCache } = require('../utils/exchangeUtils');
const globalPriceStore = require('../utils/globalPriceStore');

// Coinbase API configuration
const COINBASE_API_KEY = process.env.COINBASE_API || 'ce59e179-996c-42ae-96b9-369535eb0f54';
const COINBASE_API_SECRET = process.env.COINBASE_API_SECRET || 'cFIMJCCFJcg/w0jupqT6Yp0G06vUkEdQOzQFFdr0TngtrW/uRg1AFZOlGXWgySYLabSItOHxAA6caIOutTg5dA==';
const COINBASE_BASE_URL = 'https://api.coinbase.com/api/v3';
const COINBASE_WS_PRIMARY = process.env.COINBASE_WS_PRIMARY || 'wss://ws-direct.exchange.coinbase.com';
const COINBASE_WS_FALLBACK = process.env.COINBASE_WS_FALLBACK || 'wss://ws-feed.exchange.coinbase.com';
const COINBASE_SNAPSHOT_TTL_MS = parseInt(process.env.COINBASE_SNAPSHOT_TTL_MS || '900000', 10);

const coinbaseSnapshotCache = {
    data: null,
    timestamp: 0
};

const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

// WebSocket connections
let coinbaseWs = null;
let coinbaseWsUrl = null;
const subscribedSymbols = new Set();

// Generate Coinbase signature
const generateCoinbaseSignature = (timestamp, method, path, body = '') => {
    const message = timestamp + method + path + body;
    const key = Buffer.from(COINBASE_API_SECRET, 'base64');
    const hmac = crypto.createHmac('sha256', key);
    return hmac.update(message).digest('base64');
};

// Get price from REST API
const getCoinbasePriceRest = async (symbol) => {
    try {
        await coinbaseLimiter.waitIfNeeded();
        
        const productId = `${normalizeSymbol(symbol)}-USD`;
        const timestamp = Math.floor(Date.now() / 1000);
        const path = `/brokerage/products/${productId}`;
        
        const signature = generateCoinbaseSignature(
            timestamp.toString(),
            'GET',
            path
        );
        
        const response = await axios.get(`${COINBASE_BASE_URL}${path}`, {
            headers: {
                'CB-ACCESS-KEY': COINBASE_API,
                'CB-ACCESS-SIGN': signature,
                'CB-ACCESS-TIMESTAMP': timestamp,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data && response.data.price) {
            const price = parseFloat(response.data.price);
            priceCache.set(symbol, price, 'coinbase');
            return { price, source: 'coinbase', symbol };
        }
        
        return null;
    } catch (error) {
        console.error(`Coinbase REST error for ${symbol}:`, error.response?.data || error.message);
        return null;
    }
};

// Get multiple prices from REST API
const getCoinbasePricesBatch = async (symbols) => {
    try {
        await coinbaseLimiter.waitIfNeeded();
        
        const productIds = symbols.map(symbol => `${normalizeSymbol(symbol)}-USD`).join(',');
        const timestamp = Math.floor(Date.now() / 1000);
        const path = `/brokerage/products/batch?product_ids=${productIds}`;
        
        const signature = generateCoinbaseSignature(
            timestamp.toString(),
            'GET',
            path
        );
        
        const response = await axios.get(`${COINBASE_BASE_URL}${path}`, {
            headers: {
                'CB-ACCESS-KEY': COINBASE_API,
                'CB-ACCESS-SIGN': signature,
                'CB-ACCESS-TIMESTAMP': timestamp,
                'Content-Type': 'application/json'
            }
        });
        
        const prices = {};
        if (response.data && response.data.products) {
            response.data.products.forEach(product => {
                const symbol = product.product_id.replace('-USD', '');
                if (product.price) {
                    prices[symbol] = {
                        price: parseFloat(product.price),
                        source: 'coinbase'
                    };
                    priceCache.set(symbol, parseFloat(product.price), 'coinbase');
                }
            });
        }
        
        return prices;
    } catch (error) {
        console.error('Coinbase batch price error:', error.response?.data || error.message);
        return {};
    }
};

// Get all prices from REST API (snapshot)
const getCoinbaseAllPricesSnapshot = async () => {
    await coinbaseLimiter.waitIfNeeded();

    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/brokerage/products';

    const signature = generateCoinbaseSignature(
        timestamp.toString(),
        'GET',
        path
    );

    const response = await axios.get(`${COINBASE_BASE_URL}${path}`, {
        headers: {
            'CB-ACCESS-KEY': COINBASE_API,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp,
            'Content-Type': 'application/json'
        }
    });

    const products = response.data?.products || [];
    const symbols = products
        .filter((p) => p.quote_currency_id === 'USD' && p.trading_disabled === false)
        .map((p) => p.base_currency_id);

    const prices = {};
    const batches = chunkArray(symbols, 100);

    for (const batch of batches) {
        const batchPrices = await getCoinbasePricesBatch(batch);
        Object.assign(prices, batchPrices);
    }

    return { symbols, prices };
};

// Setup Coinbase WebSocket
const setupCoinbaseWebSocket = (symbols = [], useFallback = false) => {
    const targetUrl = useFallback ? COINBASE_WS_FALLBACK : COINBASE_WS_PRIMARY;

    if (coinbaseWs && coinbaseWs.readyState === WebSocket.OPEN) {
        // Subscribe to new symbols
        const newSymbols = symbols.filter(s => !subscribedSymbols.has(s));
        
        if (newSymbols.length > 0) {
            const subscribeMessage = {
                type: 'subscribe',
                product_ids: newSymbols.map(s => `${s}-USD`),
                channels: ['ticker']
            };
            
            coinbaseWs.send(JSON.stringify(subscribeMessage));
            newSymbols.forEach(s => subscribedSymbols.add(s));
        }
        
        return coinbaseWs;
    }
    
    // Create new WebSocket connection
    coinbaseWsUrl = targetUrl;
    coinbaseWs = new WebSocket(targetUrl);
    
    coinbaseWs.on('open', () => {
        console.log(`Coinbase WebSocket connected (${coinbaseWsUrl})`);
        
        if (symbols.length > 0) {
            const subscribeMessage = {
                type: 'subscribe',
                product_ids: symbols.map(s => `${normalizeSymbol(s)}-USD`),
                channels: ['ticker']
            };
            
            coinbaseWs.send(JSON.stringify(subscribeMessage));
            symbols.forEach(s => subscribedSymbols.add(normalizeSymbol(s)));
        }
    });
    
    coinbaseWs.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            if (message.type === 'ticker' && message.product_id) {
                const symbol = message.product_id.replace('-USD', '');
                const price = parseFloat(message.price);
                
                priceCache.set(symbol, price, 'coinbase');
                
                // Emit to connected clients if needed
                if (priceCache.listeners && priceCache.listeners[symbol]) {
                    priceCache.listeners[symbol].forEach(callback => callback(price));
                }
            }
        } catch (error) {
            console.error('Coinbase WebSocket message parse error:', error);
        }
    });
    
    coinbaseWs.on('error', (error) => {
        console.error('Coinbase WebSocket error:', error);
    });
    
    coinbaseWs.on('close', () => {
        console.log('Coinbase WebSocket closed');

        const symbolsToResubscribe = Array.from(subscribedSymbols);
        const shouldFailover = coinbaseWsUrl === COINBASE_WS_PRIMARY;

        // Attempt reconnect after delay (fail over to ws-feed if ws-direct closes)
        setTimeout(() => {
            setupCoinbaseWebSocket(symbolsToResubscribe, shouldFailover);
        }, 5000);
    });
    
    return coinbaseWs;
};

// Routes
router.get('/price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const normalizedSymbol = normalizeSymbol(symbol);
        
        // Check cache first
        const cached = priceCache.get(normalizedSymbol);
        if (cached && cached.source === 'coinbase') {
            return res.json({
                symbol: normalizedSymbol,
                price: cached.price,
                source: 'coinbase',
                cached: true,
                timestamp: cached.timestamp
            });
        }
        
        // Get fresh price
        const priceData = await getCoinbasePriceRest(normalizedSymbol);
        
        if (priceData) {
            res.json({
                ...priceData,
                cached: false,
                timestamp: Date.now()
            });
        } else {
            res.status(404).json({ 
                error: `Symbol ${normalizedSymbol} not found on Coinbase`,
                symbol: normalizedSymbol
            });
        }
    } catch (error) {
        console.error('Coinbase price route error:', error);
        res.status(500).json({ error: 'Failed to fetch price from Coinbase' });
    }
});

router.post('/prices/batch', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'Symbols array is required' });
        }
        
        const normalizedSymbols = symbols.map(normalizeSymbol);
        const prices = await getCoinbasePricesBatch(normalizedSymbols);
        
        res.json({
            source: 'coinbase',
            prices,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Coinbase batch prices error:', error);
        res.status(500).json({ error: 'Failed to fetch batch prices from Coinbase' });
    }
});

router.post('/ws/subscribe', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'Symbols array is required' });
        }
        
        const normalizedSymbols = symbols.map(normalizeSymbol);
        setupCoinbaseWebSocket(normalizedSymbols);
        
        res.json({
            symbols: normalizedSymbols,
            status: 'WebSocket subscription initiated',
            subscribedCount: normalizedSymbols.length
        });
    } catch (error) {
        console.error('WebSocket subscribe error:', error);
        res.status(500).json({ error: 'Failed to setup WebSocket subscription' });
    }
});

router.get('/products', async (req, res) => {
    try {
        await coinbaseLimiter.waitIfNeeded();
        
        const timestamp = Math.floor(Date.now() / 1000);
        const path = '/brokerage/products';
        
        const signature = generateCoinbaseSignature(
            timestamp.toString(),
            'GET',
            path
        );
        
        const response = await axios.get(`${COINBASE_BASE_URL}${path}`, {
            headers: {
                'CB-ACCESS-KEY': COINBASE_API,
                'CB-ACCESS-SIGN': signature,
                'CB-ACCESS-TIMESTAMP': timestamp,
                'Content-Type': 'application/json'
            }
        });
        
        const symbols = response.data.products
            .filter(p => p.quote_currency_id === 'USD' && p.trading_disabled === false)
            .map(p => p.base_currency_id);
        
        res.json({
            exchange: 'coinbase',
            symbols,
            count: symbols.length,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Coinbase products error:', error);
        res.status(500).json({ error: 'Failed to fetch products from Coinbase' });
    }
});

router.get('/all-prices', async (req, res) => {
    try {
        const now = Date.now();
        if (coinbaseSnapshotCache.data && now - coinbaseSnapshotCache.timestamp < COINBASE_SNAPSHOT_TTL_MS) {
            return res.json({
                ...coinbaseSnapshotCache.data,
                cached: true,
                timestamp: coinbaseSnapshotCache.timestamp
            });
        }

        const { symbols, prices } = await getCoinbaseAllPricesSnapshot();

        const payload = {
            exchange: 'coinbase',
            totalSymbols: symbols.length,
            fetched: Object.keys(prices).length,
            prices,
            timestamp: Date.now()
        };

        const storeUpdates = {};
        Object.entries(prices).forEach(([symbol, entry]) => {
            const price = entry?.price ?? entry;
            if (price === undefined || price === null) return;
            storeUpdates[symbol] = {
                price: typeof price === 'number' ? price : parseFloat(price),
                coinbasePrice: typeof price === 'number' ? price : parseFloat(price),
                isLive: false
            };
        });

        globalPriceStore.updatePrices(storeUpdates, 'coinbase');

        coinbaseSnapshotCache.data = payload;
        coinbaseSnapshotCache.timestamp = payload.timestamp;

        res.json(payload);
    } catch (error) {
        console.error('Coinbase all-prices error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch Coinbase snapshot prices' });
    }
});

// Health check
router.get('/health', async (req, res) => {
    try {
        await coinbaseLimiter.waitIfNeeded();
        
        const timestamp = Math.floor(Date.now() / 1000);
        const path = '/brokerage/time';
        
        const signature = generateCoinbaseSignature(
            timestamp.toString(),
            'GET',
            path
        );
        
        const response = await axios.get(`${COINBASE_BASE_URL}${path}`, {
            headers: {
                'CB-ACCESS-KEY': COINBASE_API,
                'CB-ACCESS-SIGN': signature,
                'CB-ACCESS-TIMESTAMP': timestamp,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({
            exchange: 'coinbase',
            status: 'online',
            serverTime: response.data.iso,
            timestamp: Date.now()
        });
    } catch (error) {
        res.json({
            exchange: 'coinbase',
            status: 'offline',
            error: error.message,
            timestamp: Date.now()
        });
    }
});

module.exports = router;
module.exports.setupCoinbaseWebSocket = setupCoinbaseWebSocket;