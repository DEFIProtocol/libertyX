const express = require('express');
const router = express.Router();
const ExchangeService = require('../services/exchangeService');

const exchangeService = new ExchangeService();

const calculateArbitrage = (prices = []) => {
    if (!Array.isArray(prices) || prices.length < 2) return null;

    const bids = prices.filter((item) => Number.isFinite(item.bid));
    const asks = prices.filter((item) => Number.isFinite(item.ask));

    if (!bids.length || !asks.length) return null;

    const bestBid = bids.reduce((best, current) => (current.bid > best.bid ? current : best));
    const bestAsk = asks.reduce((best, current) => (current.ask < best.ask ? current : best));

    const spread = bestBid.bid - bestAsk.ask;
    const spreadPercent = bestAsk.ask ? (spread / bestAsk.ask) * 100 : null;

    return {
        buyFrom: bestAsk.exchange,
        sellTo: bestBid.exchange,
        spread,
        spreadPercent
    };
};

// Unified price endpoint - works with any exchange
router.get('/price/:exchange/:symbol', async (req, res) => {
    try {
        const { exchange, symbol } = req.params;
        const { quote = 'USDT' } = req.query;

        const exchangeInstance = exchangeService.getExchange(exchange);
        const ticker = await exchangeInstance.fetchTicker(`${symbol}/${quote}`);

        res.json({
            success: true,
            exchange,
            symbol,
            quote,
            price: ticker.last,
            bid: ticker.bid,
            ask: ticker.ask,
            high24h: ticker.high,
            low24h: ticker.low,
            volume24h: ticker.quoteVolume,
            change24h: ticker.percentage,
            timestamp: ticker.timestamp,
            serverTimestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            suggestion: `Check available symbols at /api/crypto/${req.params.exchange}/markets`
        });
    }
});

// Compare prices across exchanges
router.get('/price/compare/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const exchanges = req.query.exchanges
            ? req.query.exchanges.split(',').map((name) => name.trim()).filter(Boolean)
            : undefined;

        const bestPrice = await exchangeService.getBestPrice(symbol, 'USDT', exchanges);

        res.json({
            success: true,
            symbol,
            bestPrice: bestPrice.bestPrice,
            allPrices: bestPrice.allPrices,
            arbitrageOpportunity: calculateArbitrage(bestPrice.allPrices)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get available markets for an exchange
router.get('/:exchange/markets', async (req, res) => {
    try {
        const { exchange } = req.params;
        const { quote } = req.query; // Optional filter

        const exchangeInstance = exchangeService.getExchange(exchange);
        await exchangeInstance.loadMarkets();

        let markets = Object.keys(exchangeInstance.markets);

        if (quote) {
            markets = markets.filter((market) => market.endsWith(`/${quote}`));
        }

        res.json({
            exchange,
            totalMarkets: markets.length,
            markets: markets.slice(0, 100), // Paginate
            serverTimestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
