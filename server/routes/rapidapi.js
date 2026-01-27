const express = require('express');
const axios = require('axios');

const router = express.Router();

// RapidAPI CoinRanking configuration
const RAPID_API_HOST = process.env.RAPID_API_HOST || 'coinranking1.p.rapidapi.com';
const RAPID_API_KEY = process.env.RAPID_API_KEY;

// Server-side cache for RapidAPI responses
const rapidApiCache = new Map();
const RAPID_CACHE_TTL = 30 * 1000; // 30 seconds

// Helper function with caching
const createRequest = async (endpoint, params = {}) => {
    try {
        const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
        const cached = rapidApiCache.get(cacheKey);
        
        // Return cached response if available and not expired
        if (cached && Date.now() - cached.timestamp < RAPID_CACHE_TTL) {
            console.log(`RapidAPI Cache hit: ${endpoint}`);
            return cached.data;
        }
        
        console.log(`RapidAPI Call: ${endpoint}`);
        
        const response = await axios.get(`https://${RAPID_API_HOST}${endpoint}`, {
            headers: {
                'x-rapidapi-host': RAPID_API_HOST,
                'x-rapidapi-key': RAPID_API_KEY,
                'Accept': 'application/json'
            },
            params,
            timeout: 10000 // 10 second timeout
        });
        
        // Cache the successful response
        if (response.data && response.data.status === 'success') {
            rapidApiCache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now()
            });
        }
        
        return response.data;
    } catch (error) {
        console.error('RapidAPI Error:', {
            endpoint,
            params,
            error: error.response?.data || error.message,
            status: error.response?.status
        });
        
        // Check for rate limiting from RapidAPI
        if (error.response?.status === 429) {
            throw new Error('RapidAPI rate limit exceeded. Please try again in a moment.');
        }
        
        throw error;
    }
};

// Batch request helper to minimize API calls
const batchRequest = async (requests) => {
    try {
        // Use Promise.allSettled to handle partial failures
        const results = await Promise.allSettled(
            requests.map(async (req) => {
                try {
                    const data = await createRequest(req.endpoint, req.params);
                    return { coinId: req.coinId, data };
                } catch (error) {
                    return { coinId: req.coinId, error: error.message };
                }
            })
        );
        
        // Convert to object with coinId as key
        const batchResult = {};
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.coinId) {
                batchResult[result.value.coinId] = result.value.data || result.value.error;
            }
        });
        
        return batchResult;
    } catch (error) {
        console.error('Batch request error:', error);
        throw error;
    }
};

// 1. Get all coins with limit
router.get('/coins', async (req, res) => {
    try {
        const { limit = 1200, offset = 0 } = req.query;
        
        const data = await createRequest('/coins', { 
            limit: Math.min(limit, 1500), // Cap at 1500
            offset,
            referenceCurrencyUuid: 'yhjMzLPhuIDl' // USD
        });
        
        res.json({
            success: true,
            data: data.data,
            stats: data.data?.stats,
            timestamp: new Date().toISOString(),
            cache: rapidApiCache.size,
            source: 'rapidapi'
        });
    } catch (error) {
        console.error('Error fetching coins:', error);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.message || 'Failed to fetch coins',
            details: error.response?.data
        });
    }
});

// 2. Get specific coin details
router.get('/coin/:coinId', async (req, res) => {
    try {
        const { coinId } = req.params;
        const { referenceCurrencyUuid = 'yhjMzLPhuIDl', timePeriod = '24h' } = req.query;
        
        if (!coinId) {
            return res.status(400).json({
                success: false,
                error: 'Coin ID is required'
            });
        }
        
        const data = await createRequest(`/coin/${coinId}`, {
            referenceCurrencyUuid,
            timePeriod
        });
        
        res.json({
            success: true,
            data: data.data,
            timestamp: new Date().toISOString(),
            source: 'rapidapi'
        });
    } catch (error) {
        console.error('Error fetching coin details:', error);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.message || 'Failed to fetch coin details',
            details: error.response?.data
        });
    }
});

// 3. Get coin history
router.get('/coin/:coinId/history', async (req, res) => {
    try {
        const { coinId } = req.params;
        const { timePeriod = '24h' } = req.query;
        
        if (!coinId) {
            return res.status(400).json({
                success: false,
                error: 'Coin ID is required'
            });
        }
        
        const data = await createRequest(`/coin/${coinId}/history`, { timePeriod });
        
        res.json({
            success: true,
            data: data.data,
            timestamp: new Date().toISOString(),
            metadata: {
                coinId,
                timePeriod,
                change: data.data?.change,
                historyCount: data.data?.history?.length || 0
            },
            source: 'rapidapi'
        });
    } catch (error) {
        console.error('Error fetching coin history:', error);
        res.status(error.response?.status || 500).json({
            success: false,
            error: error.message || 'Failed to fetch coin history',
            details: error.response?.data
        });
    }
});

// NEW: Batch endpoint for multiple coins
router.post('/batch/coins', async (req, res) => {
    try {
        const { coinIds = [] } = req.body;
        
        if (!Array.isArray(coinIds) || coinIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'coinIds array is required'
            });
        }
        
        // Limit batch size to prevent abuse
        const limitedIds = coinIds.slice(0, 100);
        
        const requests = limitedIds.map(coinId => ({
            coinId,
            endpoint: `/coin/${coinId}`,
            params: { referenceCurrencyUuid: 'yhjMzLPhuIDl' }
        }));
        
        const batchResult = await batchRequest(requests);
        
        res.json({
            success: true,
            data: batchResult,
            timestamp: new Date().toISOString(),
            total: limitedIds.length,
            received: Object.keys(batchResult).length,
            source: 'rapidapi-batch'
        });
    } catch (error) {
        console.error('Error in batch request:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch batch data'
        });
    }
});

// NEW: Stats endpoint to check rate limit status
router.get('/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            cacheSize: rapidApiCache.size,
            cacheTTL: RAPID_CACHE_TTL,
            endpoints: {
                coins: '/coins?limit=:limit',
                coin: '/coin/:coinId',
                history: '/coin/:coinId/history?timePeriod=:period',
                batch: 'POST /batch/coins'
            }
        },
        timestamp: new Date().toISOString()
    });
});

// Clean cache endpoint (admin only)
router.delete('/cache', (req, res) => {
    const size = rapidApiCache.size;
    rapidApiCache.clear();
    res.json({
        success: true,
        message: `Cleared ${size} cached items`,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;