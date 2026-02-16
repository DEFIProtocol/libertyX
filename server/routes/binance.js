// server/routes/binance.js
const express = require('express');
const router = express.Router();
const WebSocket = require('ws');
const axios = require('axios');
const { binanceLimiter, normalizeSymbol, createTradingPair, priceCache } = require('../utils/exchangeUtils');

// Binance API configuration
const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_API_SECRET = process.env.BINANCE_API_SECR;
const BINANCE_BASE_URL = 'https://api.binance.us/api/v3';
const BINANCE_WS_URL = 'wss://stream.binance.us:9443/ws';

// WebSocket connections map
const wsConnections = new Map();

// Debug function to check API key
const debugApiKey = () => {
    console.log('Binance API Key:', BINANCE_API_KEY ? `${BINANCE_API_KEY.substring(0, 10)}...` : 'NOT SET');
    console.log('Binance API Key length:', BINANCE_API_KEY?.length || 0);
};

// Get price from REST API (public endpoint - no API key needed)
const getBinancePriceRest = async (symbol) => {
    try {
        await binanceLimiter.waitIfNeeded();
        
        const tradingPair = createTradingPair(symbol, 'USDT');
        console.log(`Fetching Binance price for ${symbol} -> ${tradingPair}`);
        
        const response = await axios.get(`${BINANCE_BASE_URL}/ticker/price`, {
            params: { symbol: tradingPair }
            // Note: Binance price endpoint doesn't require API key
        });
        
        console.log(`Binance response for ${symbol}:`, response.data);
        
        if (response.data && response.data.price) {
            const price = parseFloat(response.data.price);
            priceCache.set(symbol, price, 'binance');
            return { price, source: 'binance', symbol };
        }
        
        return null;
    } catch (error) {
        console.error(`Binance REST error for ${symbol}:`, {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            headers: error.response?.headers
        });
        return null;
    }
};

// Get multiple prices from REST API (public endpoint)
const getBinancePricesBatch = async (symbols) => {
    try {
        await binanceLimiter.waitIfNeeded();
        
        // Binance doesn't support batch ticker/price endpoint directly
        // We'll fetch each one individually
        const prices = {};
        const promises = symbols.map(async (symbol) => {
            try {
                const tradingPair = createTradingPair(symbol, 'USDT');
                const response = await axios.get(`${BINANCE_BASE_URL}/ticker/price`, {
                    params: { symbol: tradingPair }
                });
                
                if (response.data && response.data.price) {
                    prices[symbol] = {
                        price: parseFloat(response.data.price),
                        source: 'binance'
                    };
                    priceCache.set(symbol, parseFloat(response.data.price), 'binance');
                }
            } catch (error) {
                console.error(`Failed to fetch ${symbol} from Binance:`, error.message);
            }
        });
        
        // Wait for all requests with a timeout
        await Promise.allSettled(promises);
        
        return prices;
    } catch (error) {
        console.error('Binance batch price error:', error.message);
        return {};
    }
};

// Setup WebSocket for a symbol
const setupBinanceWebSocket = (symbol) => {
    try {
        const tradingPair = `${symbol.toLowerCase()}usdt@ticker`;
        
        if (wsConnections.has(symbol)) {
            return wsConnections.get(symbol);
        }
        
        const ws = new WebSocket(`${BINANCE_WS_URL}/${tradingPair}`);
        
        ws.on('open', () => {
            console.log(`✅ Binance WebSocket connected for ${symbol}`);
        });
        
        ws.on('message', (data) => {
            try {
                const ticker = JSON.parse(data);
                if (ticker.c) { // Current price
                    const price = parseFloat(ticker.c);
                    console.log(`📈 Binance WS ${symbol}: $${price}`);
                    priceCache.set(symbol, price, 'binance');
                }
            } catch (error) {
                console.error('WebSocket message parse error:', error);
            }
        });
        
        ws.on('error', (error) => {
            console.error(`❌ Binance WebSocket error for ${symbol}:`, error.message);
        });
        
        ws.on('close', () => {
            console.log(`🔌 Binance WebSocket closed for ${symbol}`);
            wsConnections.delete(symbol);
            
            // Attempt reconnect after delay
            setTimeout(() => {
                console.log(`🔄 Attempting to reconnect Binance WS for ${symbol}...`);
                if (!wsConnections.has(symbol)) {
                    setupBinanceWebSocket(symbol);
                }
            }, 5000);
        });
        
        wsConnections.set(symbol, ws);
        return ws;
    } catch (error) {
        console.error(`Failed to setup Binance WebSocket for ${symbol}:`, error);
        return null;
    }
};

// Test endpoint to check API configuration
router.get('/test-config', (req, res) => {
    debugApiKey();
    
    res.json({
        apiKeyConfigured: !!BINANCE_API_KEY,
        apiKeyLength: BINANCE_API_KEY?.length || 0,
        apiKeyPreview: BINANCE_API_KEY ? `${BINANCE_API_KEY.substring(0, 10)}...` : null,
        baseUrl: BINANCE_BASE_URL,
        wsUrl: BINANCE_WS_URL,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Routes
router.get('/price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const normalizedSymbol = normalizeSymbol(symbol);
        
        console.log(`💰 Binance price request for: ${normalizedSymbol}`);
        
        // Check cache first
        const cached = priceCache.get(normalizedSymbol);
        if (cached && cached.source === 'binance') {
            console.log(`✅ Serving ${normalizedSymbol} from cache: $${cached.price}`);
            return res.json({
                symbol: normalizedSymbol,
                price: cached.price,
                source: 'binance',
                cached: true,
                timestamp: cached.timestamp
            });
        }
        
        // Get fresh price
        console.log(`🔄 Fetching fresh price for ${normalizedSymbol} from Binance...`);
        const priceData = await getBinancePriceRest(normalizedSymbol);
        
        if (priceData) {
            console.log(`✅ Got ${normalizedSymbol} price: $${priceData.price}`);
            res.json({
                ...priceData,
                cached: false,
                timestamp: Date.now()
            });
        } else {
            console.log(`❌ ${normalizedSymbol} not found on Binance`);
            res.status(404).json({ 
                error: `Symbol ${normalizedSymbol} not found on Binance`,
                symbol: normalizedSymbol,
                suggestion: 'Check if the symbol exists on Binance (e.g., BTC, ETH, BNB)'
            });
        }
    } catch (error) {
        console.error('Binance price route error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch price from Binance',
            details: error.message 
        });
    }
});

router.post('/prices/batch', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'Symbols array is required' });
        }
        
        console.log(`📦 Binance batch request for ${symbols.length} symbols:`, symbols);
        
        const normalizedSymbols = symbols.map(normalizeSymbol);
        const prices = await getBinancePricesBatch(normalizedSymbols);
        
        console.log(`✅ Binance batch got ${Object.keys(prices).length} prices`);
        
        res.json({
            source: 'binance',
            prices,
            requested: normalizedSymbols.length,
            found: Object.keys(prices).length,
            missing: normalizedSymbols.filter(s => !prices[s]).length,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Binance batch prices error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch batch prices from Binance',
            details: error.message 
        });
    }
});

router.get('/ws/connect/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const normalizedSymbol = normalizeSymbol(symbol);
        
        console.log(`🔌 WebSocket connection requested for ${normalizedSymbol}`);
        
        setupBinanceWebSocket(normalizedSymbol);
        
        res.json({
            symbol: normalizedSymbol,
            status: 'WebSocket connection initiated',
            endpoint: `${BINANCE_WS_URL}/${normalizedSymbol.toLowerCase()}usdt@ticker`,
            message: 'WebSocket will provide real-time price updates'
        });
    } catch (error) {
        console.error('WebSocket connect error:', error);
        res.status(500).json({ error: 'Failed to setup WebSocket' });
    }
});

router.get('/exchange-info', async (req, res) => {
    try {
        console.log('📊 Fetching Binance exchange info...');
        await binanceLimiter.waitIfNeeded();
        
        const response = await axios.get(`${BINANCE_BASE_URL}/exchangeInfo`);
        const symbols = response.data.symbols
            .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
            .map(s => s.baseAsset);
        
        console.log(`📊 Binance has ${symbols.length} USDT trading pairs`);
        
        res.json({
            exchange: 'binance',
            symbols: symbols.slice(0, 50), // Return first 50 to avoid huge response
            totalCount: symbols.length,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Binance exchange info error:', error.message);
        res.status(500).json({ 
            error: 'Failed to fetch exchange info from Binance',
            details: error.message 
        });
    }
});

// 24hr ticker snapshot (REST)
router.get('/ticker/24hr', async (req, res) => {
    try {
        await binanceLimiter.waitIfNeeded();

        const { symbol } = req.query;
        const response = await axios.get(`${BINANCE_BASE_URL}/ticker/24hr`, {
            params: symbol ? { symbol: symbol.toUpperCase() } : undefined
        });

        res.json({
            success: true,
            data: response.data,
            timestamp: Date.now(),
            source: 'binance'
        });
    } catch (error) {
        console.error('Binance 24hr ticker error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all current prices (REST snapshot)
router.get('/all-prices', async (req, res) => {
    try {
        console.log('📊 Fetching ALL Binance prices via REST...');
        await binanceLimiter.waitIfNeeded();

        const response = await axios.get(`${BINANCE_BASE_URL}/ticker/price`);
        const list = Array.isArray(response.data) ? response.data : [];

        const prices = {};
        let usdtCount = 0;

        for (const item of list) {
            const symbolPair = item?.symbol;
            if (!symbolPair || !symbolPair.endsWith('USDT')) continue;
            usdtCount += 1;
            const base = symbolPair.replace(/USDT$/, '');
            prices[base] = {
                price: parseFloat(item.price),
                pair: symbolPair,
                source: 'rest',
                timestamp: Date.now()
            };
        }

        res.json({
            exchange: 'binance.us',
            totalPairs: usdtCount,
            fetched: Object.keys(prices).length,
            prices,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Binance all-prices error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Simple symbol check
router.get('/check/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const normalizedSymbol = normalizeSymbol(symbol);
        const tradingPair = createTradingPair(normalizedSymbol, 'USDT');
        
        console.log(`🔍 Checking if ${normalizedSymbol} exists on Binance...`);
        
        const response = await axios.get(`${BINANCE_BASE_URL}/exchangeInfo`);
        const exists = response.data.symbols.some(s => 
            s.symbol === tradingPair && s.status === 'TRADING'
        );
        
        res.json({
            symbol: normalizedSymbol,
            tradingPair,
            existsOnBinance: exists,
            suggestion: exists ? 'Symbol is available' : 'Try different symbol or check spelling',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Symbol check error:', error);
        res.status(500).json({ error: 'Failed to check symbol' });
    }
});

// Health check
router.get('/health', async (req, res) => {
    try {
        console.log('🏥 Binance health check...');
        await binanceLimiter.waitIfNeeded();
        
        const startTime = Date.now();
        const response = await axios.get(`${BINANCE_BASE_URL}/ping`);
        const responseTime = Date.now() - startTime;
        
        console.log(`✅ Binance API is online (${responseTime}ms)`);
        
        res.json({
            exchange: 'binance',
            status: 'online',
            responseTime: `${responseTime}ms`,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('❌ Binance health check failed:', error.message);
        res.json({
            exchange: 'binance',
            status: 'offline',
            error: error.message,
            timestamp: Date.now()
        });
    }
});

// Test a few common symbols
router.get('/test/common', async (req, res) => {
    try {
        const commonSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOT', 'DOGE', 'AVAX', 'MATIC'];
        console.log(`🧪 Testing ${commonSymbols.length} common symbols on Binance...`);
        
        const results = {};
        const promises = commonSymbols.map(async (symbol) => {
            try {
                const priceData = await getBinancePriceRest(symbol);
                results[symbol] = priceData ? {
                    success: true,
                    price: priceData.price
                } : {
                    success: false,
                    error: 'Not found'
                };
            } catch (error) {
                results[symbol] = {
                    success: false,
                    error: error.message
                };
            }
        });
        
        await Promise.allSettled(promises);
        
        const successful = Object.values(results).filter(r => r.success).length;
        console.log(`🧪 Test results: ${successful}/${commonSymbols.length} successful`);
        
        res.json({
            test: 'common_symbols',
            results,
            summary: {
                total: commonSymbols.length,
                successful,
                failed: commonSymbols.length - successful
            },
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Common symbols test error:', error);
        res.status(500).json({ error: 'Test failed' });
    }
});

module.exports = router;
module.exports.setupBinanceWebSocket = setupBinanceWebSocket;
module.exports.getBinancePriceRest = getBinancePriceRest; // Export for use in pricing.js