const express = require('express');
const axios = require('axios');

const router = express.Router();

const ONEINCH_TOKEN_BASE_URL = 'https://api.1inch.com/token';
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY || '';

router.get('/tokens', async (req, res) => {
    try {
        const { chainId = '1', provider = '1inch' } = req.query;
        const url = `${ONEINCH_TOKEN_BASE_URL}/v1.2/${chainId}`;

        const response = await axios.get(url, {
            headers: ONEINCH_API_KEY
                ? { Authorization: `Bearer ${ONEINCH_API_KEY}`, accept: 'application/json' }
                : { accept: 'application/json' },
            params: { provider }
        });

        const tokensCount = response.data?.tokens
            ? Object.keys(response.data.tokens).length
            : Object.keys(response.data || {}).length;
        void tokensCount;

        res.json({
            success: true,
            data: response.data,
            source: '1inch'
        });
    } catch (error) {
        console.error('[1inch] tokens error', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        });
        const status = error.response?.status || 500;
        res.status(status).json({
            success: false,
            error: error.response?.data || error.message
        });
    }
});

module.exports = router;
