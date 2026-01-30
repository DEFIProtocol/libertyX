require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const { rapidApiLimiter, cacheMiddleware } = require('./middleware/ratelimiter');
const globalPriceStore = require('./utils/globalPriceStore');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'gridlockdb',
    password: process.env.DB_PASSWORD || 'asdas',
    port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
    } else {
        console.log('Connected to PostgreSQL database');
        release();
    }
});

// Store pool in app for use in routes
app.set('pool', pool);

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const tokensRoutes = require('./routes/tokens')(pool);
const binanceRoutes = require('./routes/binance');
const globalPricesRoutes = require('./routes/globalPrices');

// API Routes
app.use('/api/tokens', tokensRoutes);
app.use('/api/binance', binanceRoutes);
app.use('/api/global-prices', globalPricesRoutes(pool));

// Add RapidAPI routes with rate limiting and caching
const rapidapiRoutes = require('./routes/rapidapi');
app.use('/api/rapidapi', cacheMiddleware, rapidApiLimiter, rapidapiRoutes);

// Kick off RapidAPI refresh for global price store
const refreshRapidApiPrices = globalPricesRoutes.refreshRapidApiPrices;
if (refreshRapidApiPrices) {
    refreshRapidApiPrices().catch((error) => {
        console.error('Initial RapidAPI refresh failed:', error.message);
    });

    setInterval(() => {
        refreshRapidApiPrices().catch((error) => {
            console.error('Scheduled RapidAPI refresh failed:', error.message);
        });
    }, 15 * 60 * 1000);
}

// Simple test route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: 'connected',
            api: 'running',
            rapidapi: process.env.RAPID_API_KEY ? 'configured' : 'not configured'
        }
    });
});

// WS proxy status
app.get('/api/ws-status', (req, res) => {
    res.json({
        binance: {
            upstreamConnected: binanceWsConnected,
            clients: wsClients.size
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Something went wrong!',
        message: err.message 
    });
});

// ===== Binance WS proxy =====
const BINANCE_MINI_TICKER_URL = process.env.BINANCE_MINI_TICKER_URL || 'wss://stream.binance.us:9443/ws/!ticker@arr';
let binanceWs = null;
let binanceWsConnected = false;
const wsClients = new Set();
let lastBinanceLog = 0;

const connectBinanceWs = () => {
    if (binanceWs && binanceWsConnected) return;

    binanceWs = new WebSocket(BINANCE_MINI_TICKER_URL);

    binanceWs.on('open', () => {
        binanceWsConnected = true;
        console.log('✅ Connected to Binance miniTicker stream');
    });

    binanceWs.on('message', (data) => {
        try {
            const parsed = JSON.parse(data.toString());
            if (Array.isArray(parsed)) {
                const updates = [];

                parsed.forEach((ticker) => {
                    if (ticker.s && ticker.c && ticker.s.endsWith('USDT')) {
                        const baseSymbol = ticker.s.replace(/USDT$/i, '').toUpperCase();
                        const price = parseFloat(ticker.c);
                        updates.push({ symbol: baseSymbol, pair: ticker.s, price });
                        if (!Number.isNaN(price)) {
                            globalPriceStore.updatePrice(baseSymbol, {
                                price,
                                binancePrice: price,
                                source: 'binance',
                                isLive: true,
                                pair: ticker.s
                            });
                        }
                    }
                });

                const now = Date.now();
                if (now - lastBinanceLog > 5000) {
                    lastBinanceLog = now;
                    console.log(`📦 Binance miniTicker array size: ${parsed.length}`);
                    console.log('📌 Binance miniTicker sample:', parsed[0]);
                }
            }
        } catch (error) {
            // ignore parse errors
        }
        // Broadcast raw data to all connected clients
        for (const client of wsClients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data.toString());
            }
        }
    });

    binanceWs.on('close', (code, reason) => {
        binanceWsConnected = false;
        console.log(`🔌 Binance miniTicker stream closed (${code}) ${reason?.toString() || ''}. Reconnecting in 3s...`);
        setTimeout(connectBinanceWs, 3000);
    });

    binanceWs.on('error', (error) => {
        binanceWsConnected = false;
        console.error('❌ Binance miniTicker stream error:', error.message);
        try {
            binanceWs.close();
        } catch (e) {
            // ignore
        }
    });
};

const wss = new WebSocket.Server({ server, path: '/ws/binance' });
wss.on('connection', (ws) => {
    wsClients.add(ws);
    connectBinanceWs();

    console.log('🔗 Client connected to /ws/binance');

    ws.on('error', (error) => {
        console.error('❌ Client WS error:', error.message);
    });

    ws.on('close', () => {
        wsClients.delete(ws);
        console.log('🔌 Client disconnected from /ws/binance');
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Available endpoints:');
    console.log(`  http://localhost:${PORT}/api/tokens`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/coins`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/coin/:coinId`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/coin/:coinId/history`);
    console.log(`  http://localhost:${PORT}/api/rapidapi/stats`);
    console.log(`  http://localhost:${PORT}/api/health`);
    console.log(`  ws://localhost:${PORT}/ws/binance`);
});