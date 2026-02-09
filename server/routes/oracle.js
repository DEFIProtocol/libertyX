// BigInt JSON serialization for ethers round data
if (typeof BigInt !== 'undefined' && !BigInt.prototype.toJSON) {
    // eslint-disable-next-line no-extend-native
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
}

const express = require('express');
const OracleService = require('../services/oracleService');

const router = express.Router();
const oracleService = new OracleService();

router.get('/feeds/:chain', async (req, res) => {
    try {
        const { chain } = req.params;
        const feeds = await oracleService.getFeedsByChain(chain);

        res.json({
            success: true,
            chain,
            count: feeds.length,
            feeds
        });
    } catch (error) {
        console.error('Error fetching feeds:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/price/:chain/:token', async (req, res) => {
    try {
        const { chain, token } = req.params;
        const priceData = await oracleService.getPriceByToken(chain, token);

        if (!priceData) {
            return res.status(404).json({
                success: false,
                error: 'No feed found for token',
                chain,
                token
            });
        }

        res.json({
            success: true,
            ...priceData
        });
    } catch (error) {
        console.error('Error fetching price:', error);
        res.status(404).json({
            success: false,
            error: error.message,
            chain: req.params.chain,
            token: req.params.token
        });
    }
});

router.post('/batch-prices', async (req, res) => {
    try {
        const { chain, tokens, limit } = req.body;

        if (!chain) {
            return res.status(400).json({
                success: false,
                error: 'Chain is required'
            });
        }

        if (tokens && !Array.isArray(tokens)) {
            return res.status(400).json({
                success: false,
                error: 'Tokens must be an array when provided'
            });
        }

        const prices = await oracleService.getBatchPrices(chain, tokens, { limit });

        res.json({
            success: true,
            chain,
            count: prices.length,
            prices
        });
    } catch (error) {
        console.error('Error fetching batch prices:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { chain, query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        const feeds = await oracleService.getFeedsByChain(chain || 'ethereum');
        const results = feeds.filter((feed) =>
            feed.name?.toLowerCase().includes(String(query).toLowerCase()) ||
            feed.asset?.toLowerCase().includes(String(query).toLowerCase())
        );

        res.json({
            success: true,
            query,
            count: results.length,
            results
        });
    } catch (error) {
        console.error('Error searching feeds:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/chains', (req, res) => {
    const chains = Object.keys(oracleService.feedsDirectory).map((chain) => ({
        name: chain,
        label: chain.charAt(0).toUpperCase() + chain.slice(1),
        feedsUrl: oracleService.feedsDirectory[chain]
    }));

    res.json({
        success: true,
        chains
    });
});

module.exports = router;
