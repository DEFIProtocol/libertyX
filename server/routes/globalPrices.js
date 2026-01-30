const express = require('express');
const axios = require('axios');
const globalPriceStore = require('../utils/globalPriceStore');
const { rapidApiLimiter } = require('../middleware/ratelimiter');

const refreshRapidApiPrices = async () => {
    if (!globalPriceStore.shouldFetchRapidApi()) {
        return {
            success: false,
            message: 'Too soon to refresh. Wait 15 minutes.',
            nextRefresh: globalPriceStore.lastRapidApiFetch + globalPriceStore.RAPID_API_INTERVAL
        };
    }

    const response = await axios.get('https://coinranking1.p.rapidapi.com/coins', {
        params: {
            referenceCurrencyUuid: 'yhjMzLPhuIDl',
            timePeriod: '24h',
            'tiers[0]': '1',
            orderBy: 'marketCap',
            orderDirection: 'desc',
            limit: '1500',
            offset: '0'
        },
        headers: {
            'X-RapidAPI-Key': process.env.RAPID_API_KEY,
            'X-RapidAPI-Host': 'coinranking1.p.rapidapi.com'
        }
    });

    const coins = response.data?.data?.coins || [];
    const priceUpdates = {};

    coins.forEach((coin) => {
        const symbol = coin?.symbol?.toUpperCase();
        if (!symbol) return;

        const existing = globalPriceStore.getPrice(symbol);
        const hasLiveBinance = existing && existing.source === 'binance' && existing.isLive;

        priceUpdates[symbol] = {
            price: parseFloat(coin.price),
            rapidPrice: parseFloat(coin.price),
            binancePrice: hasLiveBinance ? existing.price : null,
            source: hasLiveBinance ? 'binance' : 'rapidapi',
            uuid: coin.uuid,
            name: coin.name,
            rank: coin.rank,
            marketCap: coin.marketCap,
            change: coin.change,
            coinData: coin,
            isLive: hasLiveBinance,
            lastUpdated: hasLiveBinance ? existing.lastUpdated : Date.now()
        };
    });

    globalPriceStore.updatePrices(priceUpdates, 'rapidapi');
    globalPriceStore.markRapidApiFetched();

    return {
        success: true,
        message: `Refreshed ${coins.length} coins from RapidAPI`,
        updated: Object.keys(priceUpdates).length,
        timestamp: Date.now()
    };
};

const createGlobalPricesRouter = (pool) => {
    const router = express.Router();

    router.get('/all', (req, res) => {
        const prices = globalPriceStore.getAllPrices();
        res.json({
            success: true,
            count: Object.keys(prices).length,
            prices,
            timestamp: Date.now()
        });
    });

    router.post('/batch', (req, res) => {
        const { symbols } = req.body;

        if (!symbols || !Array.isArray(symbols)) {
            return res.status(400).json({
                success: false,
                error: 'Symbols array required'
            });
        }

        const prices = globalPriceStore.getBatchPrices(symbols);
        res.json({
            success: true,
            count: Object.keys(prices).length,
            prices,
            requested: symbols.length,
            timestamp: Date.now()
        });
    });

    router.post('/refresh-rapidapi', rapidApiLimiter, async (req, res) => {
        try {
            const result = await refreshRapidApiPrices();
            res.json(result);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    router.get('/symbol/:symbol', (req, res) => {
        const { symbol } = req.params;
        const price = globalPriceStore.getPrice(symbol);

        if (price) {
            res.json({ success: true, price });
        } else {
            res.status(404).json({
                success: false,
                error: `Price not found for ${symbol}`
            });
        }
    });

    router.get('/tokens', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM tokens ORDER BY symbol');
            const tokens = result.rows || [];

            const enriched = tokens.map((token) => {
                const symbol = token?.symbol?.toUpperCase();
                const priceEntry = symbol ? globalPriceStore.getPrice(symbol) : null;

                const rapidPrice = priceEntry?.rapidPrice ?? (priceEntry?.source === 'rapidapi' ? priceEntry.price : null);
                const binancePrice = priceEntry?.binancePrice ?? (priceEntry?.source === 'binance' ? priceEntry.price : null);
                const price = binancePrice ?? rapidPrice ?? token.price ?? null;

                return {
                    ...token,
                    symbol: token.symbol,
                    price,
                    marketCap: priceEntry?.marketCap ?? token.marketCap ?? token.market_cap ?? null,
                    priceSource: priceEntry?.source ?? null,
                    priceUpdatedAt: priceEntry?.lastUpdated ?? null,
                    isLive: priceEntry?.isLive ?? false
                };
            });

            res.json({
                success: true,
                count: enriched.length,
                tokens: enriched,
                storeStats: globalPriceStore.getStats(),
                timestamp: Date.now()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    router.get('/health', (req, res) => {
        const stats = globalPriceStore.getStats();
        res.json({
            success: true,
            stats: {
                totalPrices: stats.total,
                binancePrices: stats.binancePrices,
                rapidApiPrices: stats.rapidApiPrices,
                lastRapidApiFetch: stats.lastRapidApiFetch,
                storeAge: Date.now() - stats.lastRapidApiFetch
            },
            timestamp: Date.now()
        });
    });

    router.get('/debug-store', (req, res) => {
        const allEntries = Array.from(globalPriceStore.prices.entries());

        const sourceCounts = {};
        allEntries.forEach(([, data]) => {
            const source = data.source || 'unknown';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });

        const samples = allEntries.slice(0, 10).map(([symbol, data]) => ({
            symbol,
            price: data.price,
            rapidPrice: data.rapidPrice,
            binancePrice: data.binancePrice,
            source: data.source,
            isLive: data.isLive,
            lastUpdated: data.lastUpdated
        }));

        res.json({
            success: true,
            stats: {
                total: allEntries.length,
                sourceCounts,
                storeSize: globalPriceStore.prices.size
            },
            samples,
            allSymbols: allEntries.map(([symbol]) => symbol).slice(0, 100)
        });
    });

    return router;
};

createGlobalPricesRouter.refreshRapidApiPrices = refreshRapidApiPrices;

module.exports = createGlobalPricesRouter;
