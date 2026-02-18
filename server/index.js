require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { Pool } = require('pg');
const { rapidApiLimiter, cacheMiddleware } = require('./middleware/ratelimiter');
const globalPriceStore = require('./utils/globalPriceStore');
const fs = require('fs'); // Move this import up here

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
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
app.set('trust proxy', 1);
app.use(
  cors({
    origin: [
      'https://libertyx.onrender.com',
      'https://libertyx-1.onrender.com',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(express.json());

// Import routes
const tokensRoutes = require('./routes/tokens')(pool);
const binanceRoutes = require('./routes/binance');
const coinbaseRoutes = require('./routes/coinbase');
const infuraRoutes = require('./routes/infura');
const userRoutes = require('./routes/user');
const cryptoRoutes = require('./routes/cryptoRoutes');
const oneInchRoutes = require('./routes/oneinch');
const fusionRoutes = require('./routes/fusion');
const globalPricesRoutes = require('./routes/globalPrices');
const oracleRoutes = require('./routes/oracle');

// API Routes
app.use('/api/tokens', tokensRoutes);
app.use('/api/binance', binanceRoutes);
app.use('/api/coinbase', coinbaseRoutes);
app.use('/api/infura', infuraRoutes(pool));
app.use('/api/users', userRoutes(pool));
app.use('/api/crypto', cryptoRoutes);
app.use('/api/oneinch', oneInchRoutes);
app.use('/api/fusion', fusionRoutes);
app.use('/api/global-prices', globalPricesRoutes(pool));
app.use('/api/oracle', oracleRoutes);

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
        },
        coinbase: {
            upstreamConnected: coinbaseUpstreamConnected,
            clients: coinbaseWsClients.size
        }
    });
});

// ===== Binance WS proxy =====
const BINANCE_MINI_TICKER_URL = process.env.BINANCE_MINI_TICKER_URL || 'wss://stream.binance.us:9443/ws/!ticker@arr';
let binanceWs = null;
let binanceWsConnected = false;
const wsClients = new Set();
let lastBinanceLog = 0;

// ===== Coinbase WS proxy =====
const COINBASE_WS_PRIMARY = process.env.COINBASE_WS_PRIMARY || 'wss://ws-direct.exchange.coinbase.com';
const COINBASE_WS_FALLBACK = process.env.COINBASE_WS_FALLBACK || 'wss://ws-feed.exchange.coinbase.com';
const coinbaseWsClients = new Set();
let coinbaseUpstreamConnected = false;

const connectBinanceWs = () => {
    if (binanceWs && binanceWsConnected) return;

    binanceWs = new WebSocket(BINANCE_MINI_TICKER_URL);

    binanceWs.on('open', () => {
        binanceWsConnected = true;
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
        setTimeout(connectBinanceWs, 3000);
    });

    binanceWs.on('error', (error) => {
        binanceWsConnected = false;
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

    ws.on('error', (error) => {
    });

    ws.on('close', () => {
        wsClients.delete(ws);
    });
});

const createCoinbaseUpstream = (client, upstreamUrl) => {
    let upstream = new WebSocket(upstreamUrl);
    let lastClientMessages = [];
    let usingFallback = upstreamUrl === COINBASE_WS_FALLBACK;

    const connectUpstream = (url) => {
        upstream = new WebSocket(url);

        upstream.on('open', () => {
            coinbaseUpstreamConnected = true;
            lastClientMessages.forEach((msg) => {
                try {
                    upstream.send(msg);
                } catch (error) {
                    // ignore
                }
            });
        });

        upstream.on('message', (data) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data.toString());
            }
        });

        upstream.on('close', () => {
            coinbaseUpstreamConnected = false;
            const nextUrl = usingFallback ? COINBASE_WS_PRIMARY : COINBASE_WS_FALLBACK;
            usingFallback = !usingFallback;
            setTimeout(() => connectUpstream(nextUrl), 3000);
        });

        upstream.on('error', () => {
            coinbaseUpstreamConnected = false;
            try {
                upstream.close();
            } catch (error) {
                // ignore
            }
        });
    };

    connectUpstream(upstreamUrl);

    client.on('message', (data) => {
        const message = data.toString();
        lastClientMessages = [...lastClientMessages, message].slice(-5);

        if (upstream.readyState === WebSocket.OPEN) {
            upstream.send(message);
        }
    });

    const cleanup = () => {
        try {
            upstream.close();
        } catch (error) {
            // ignore
        }
    };

    client.on('close', cleanup);
    client.on('error', cleanup);
};

const coinbaseWss = new WebSocket.Server({ server, path: '/ws/coinbase' });
coinbaseWss.on('connection', (ws) => {
    coinbaseWsClients.add(ws);
    createCoinbaseUpstream(ws, COINBASE_WS_PRIMARY);

    ws.on('close', () => {
        coinbaseWsClients.delete(ws);
    });
});

// ===== Serve React Frontend =====
// This MUST come after all API routes but before error handling
const frontendBuildPath = path.join(__dirname, '../dex/build'); // Adjust this path as needed

// Check if the frontend build directory exists
if (fs.existsSync(frontendBuildPath)) {
    console.log('Serving static files from:', frontendBuildPath);
    
    // Serve static files
    app.use(express.static(frontendBuildPath));
    
    // For any route that's not an API or WebSocket route, serve the index.html
    app.get('*', (req, res, next) => {
        // Skip API and WebSocket routes
        if (req.path.startsWith('/api/') || req.path.startsWith('/ws/')) {
            return next();
        }
        res.sendFile(path.join(frontendBuildPath, 'index.html'));
    });
} else {
    console.log('Frontend build directory not found at:', frontendBuildPath);
    console.log('Current directory:', __dirname);
    console.log('Looking for build at:', path.join(__dirname, '../dex/build'));
}

// Error handling middleware (this should be LAST)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        success: false,
        error: 'Something went wrong!',
        message: err.message 
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
    console.log(`  ws://localhost:${PORT}/ws/coinbase`);
    console.log(`Frontend static files being served from: ${frontendBuildPath}`);
});