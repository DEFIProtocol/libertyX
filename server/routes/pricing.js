// server/routes/pricing.js - SUPER SIMPLE RAPIDAPI-ONLY
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Helper: Get batch prices from RapidAPI
async function getBatchPrices(symbols) {
    try {
        const response = await axios.post('http://localhost:3001/api/rapidapi/prices/batch', {
            symbols
        });
        return response.data.prices || {};
    } catch (error) {
        console.error('RapidAPI batch failed:', error.message);
        return {};
    }
}

// Get pool helper
const getPool = (req) => {
    return req.app.get('pool');
};

// ========== MAIN ENDPOINTS ==========

// 1. Get prices for admin panel
router.post('/prices/batch', async (req, res) => {
    try {
        const { symbols } = req.body;
        
        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({ error: 'Symbols array required' });
        }
        
        console.log(`💰 Getting ${symbols.length} prices from RapidAPI`);
        
        const prices = await getBatchPrices(symbols);
        
        res.json({
            success: true,
            source: 'rapidapi',
            prices,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Batch prices error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Get ALL token prices from database with RapidAPI prices
router.get('/tokens/prices', async (req, res) => {
    try {
        const pool = getPool(req);
        
        // Get tokens from database
        const tokensResult = await pool.query('SELECT id, symbol, name, price as db_price FROM tokens ORDER BY symbol');
        const symbols = tokensResult.rows.map(row => row.symbol);
        
        // Get current prices from RapidAPI
        const currentPrices = await getBatchPrices(symbols);
        
        // Combine data
        const tokens = tokensResult.rows.map(token => {
            const symbol = token.symbol.toUpperCase();
            const priceData = currentPrices[symbol];
            
            return {
                id: token.id,
                symbol: token.symbol,
                name: token.name,
                databasePrice: token.db_price,
                currentPrice: priceData ? priceData.price : null,
                source: priceData ? 'rapidapi' : null,
                found: !!priceData
            };
        });
        
        const foundCount = tokens.filter(t => t.found).length;
        
        res.json({
            success: true,
            tokens,
            stats: {
                total: tokens.length,
                found: foundCount,
                missing: tokens.length - foundCount
            },
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Tokens prices error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. Update database with RapidAPI prices
router.post('/tokens/update-prices', async (req, res) => {
    try {
        const pool = getPool(req);
        
        // Get all tokens
        const tokensResult = await pool.query('SELECT id, symbol FROM tokens');
        const symbols = tokensResult.rows.map(row => row.symbol);
        
        console.log(`🔄 Updating ${symbols.length} tokens from RapidAPI`);
        
        // Get current prices
        const currentPrices = await getBatchPrices(symbols);
        
        // Update database
        let updated = 0;
        let failed = [];
        
        for (const token of tokensResult.rows) {
            const symbol = token.symbol.toUpperCase();
            const priceData = currentPrices[symbol];
            
            if (priceData && priceData.price) {
                try {
                    await pool.query(
                        'UPDATE tokens SET price = $1, updated_at = NOW() WHERE id = $2',
                        [priceData.price, token.id]
                    );
                    updated++;
                } catch (error) {
                    failed.push({ symbol, error: error.message });
                }
            } else {
                failed.push({ symbol, error: 'Price not found' });
            }
        }
        
        res.json({
            success: true,
            message: `Updated ${updated} tokens`,
            stats: {
                total: tokensResult.rows.length,
                updated,
                failed: failed.length
            },
            failed: failed.slice(0, 10), // Show first 10 failures
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('Update prices error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 4. Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        source: 'rapidapi',
        timestamp: Date.now()
    });
});

module.exports = router;