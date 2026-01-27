// server/routes/rapidapi.js - SIMPLE & WORKING
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Configuration - USE YOUR ACTUAL VALUES
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '749cb16441msh27276ffc2efb167p15090ajsn8cf28aa64aae';
const RAPIDAPI_HOST = 'coinranking1.p.rapidapi.com';

const headers = {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': RAPIDAPI_KEY
};

// Cache for performance
let allCoinsCache = [];
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Helper: Get ALL coins (cached)
async function getAllCoins() {
    const now = Date.now();
    
    if (allCoinsCache.length > 0 && (now - cacheTime) < CACHE_TTL) {
        return allCoinsCache;
    }
    
    try {
        console.log('🔄 Fetching ALL coins from RapidAPI...');
        
        const response = await axios.get(`https://${RAPIDAPI_HOST}/coins`, {
            params: { limit: 2000 },
            headers
        });
        
        allCoinsCache = response.data?.data?.coins || [];
        cacheTime = now;
        
        console.log(`✅ Loaded ${allCoinsCache.length} coins`);
        return allCoinsCache;
    } catch (error) {
        console.error('❌ Failed to fetch coins:', error.message);
        throw error;
    }
}

// ========== SIMPLE ENDPOINTS ==========

// 1. Health check
router.get('/health', async (req, res) => {
    try {
        const response = await axios.get(`https://${RAPIDAPI_HOST}/coins?limit=1`, { headers });
        
        res.json({
            status: 'online',
            totalCoins: response.data?.data?.stats?.total || 0
        });
    } catch (error) {
        res.json({
            status: 'error',
            error: error.message
        });
    }
});

// 2. Get ALL coins (for frontend)
router.get('/coins', async (req, res) => {
    try {
        const { limit = '100' } = req.query;
        
        const response = await axios.get(`https://${RAPIDAPI_HOST}/coins`, {
            params: { limit },
            headers
        });
        
        // Return EXACT format your frontend expects
        res.json(response.data);
        
    } catch (error) {
        console.error('Coins error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. Get batch prices (for your admin panel)
router.post('/prices/batch', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'Symbols array required' });
        }
        
        console.log(`📦 Getting prices for ${symbols.length} symbols`);
        
        const allCoins = await getAllCoins();
        const prices = {};
        const missing = [];
        
        symbols.forEach(symbol => {
            const upperSymbol = symbol.toUpperCase();
            const coin = allCoins.find(c => c.symbol.toUpperCase() === upperSymbol);
            
            if (coin && coin.price) {
                prices[upperSymbol] = {
                    price: parseFloat(coin.price),
                    uuid: coin.uuid,
                    name: coin.name,
                    marketCap: coin.marketCap,
                    volume24h: coin['24hVolume'],
                    rank: coin.rank
                };
            } else {
                missing.push(upperSymbol);
            }
        });
        
        res.json({
            success: true,
            prices,
            stats: {
                requested: symbols.length,
                found: Object.keys(prices).length,
                missing: missing.length
            },
            missingSymbols: missing
        });
        
    } catch (error) {
        console.error('Batch prices error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Get single coin
router.get('/coin/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        
        const response = await axios.get(`https://${RAPIDAPI_HOST}/coin/${uuid}`, { headers });
        
        res.json(response.data);
        
    } catch (error) {
        console.error('Coin error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// 5. Search coins by symbol/name
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const allCoins = await getAllCoins();
        
        const results = allCoins.filter(coin => 
            coin.symbol.toLowerCase().includes(query.toLowerCase()) ||
            coin.name.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 20);
        
        res.json({
            success: true,
            query,
            results: results.map(coin => ({
                uuid: coin.uuid,
                symbol: coin.symbol,
                name: coin.name,
                price: coin.price,
                rank: coin.rank
            }))
        });
        
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;