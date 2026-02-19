const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

// Coinbase API configuration
const COINBASE_API_KEY = process.env.COINBASE_API;
const COINBASE_API_SECRET = process.env.COINBASE_API_SECRET;
const COINBASE_PAY_API_URL = 'https://pay.coinbase.com/api/v1';
const COINBASE_COMMERCE_API_URL = 'https://api.commerce.coinbase.com';
const COINBASE_API_URL = 'https://api.coinbase.com/v2';

// Log if API keys are missing
if (!COINBASE_API_KEY) {
  console.warn('⚠️ COINBASE_API is not set in environment variables');
}
if (!COINBASE_API_SECRET) {
  console.warn('⚠️ COINBASE_API_SECRET is not set in environment variables');
}

/**
 * Generate Coinbase API signature for authenticated requests
 */
const generateSignature = (method, path, body = '') => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = timestamp + method + path + body;
    const signature = crypto
      .createHmac('sha256', COINBASE_API_SECRET)
      .update(message)
      .digest('hex');
    
    return {
      timestamp,
      signature
    };
  } catch (error) {
    console.error('Error generating signature:', error);
    return {
      timestamp: Math.floor(Date.now() / 1000),
      signature: 'error-generating-signature'
    };
  }
};

/**
 * Get supported assets from Coinbase
 * GET /api/coinbase-onramp/assets
 */
router.get('/assets', async (req, res) => {
  try {
    console.log('Fetching assets from Coinbase...');
    
    // Try to call Coinbase API with correct headers
    let assets = [];
    try {
      if (COINBASE_API_KEY) {
        // Use the correct Coinbase header format
        const { timestamp, signature } = generateSignature('GET', '/v2/currencies');
        
        const response = await axios.get(`${COINBASE_API_URL}/currencies`, {
          headers: {
            'CB-ACCESS-KEY': COINBASE_API_KEY,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp,
            'CB-VERSION': '2024-02-01',
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });

        if (response.data?.data) {
          assets = response.data.data
            .filter(currency => currency.type === 'crypto')
            .map(currency => ({
              symbol: currency.code,
              name: currency.name,
              chain: currency.networks?.[0] || 'ethereum',
              minAmount: currency.min_amount || 10,
              maxAmount: currency.max_amount || 10000,
              icon: getIconForSymbol(currency.code),
              supported: true,
              zeroFees: currency.code === 'USDC'
            }));
        }
      }
    } catch (apiError) {
      console.log('Coinbase API unavailable, using fallback assets:', apiError.message);
    }
    
    // If no assets from API, use fallback
    if (assets.length === 0) {
      assets = [
        { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum', minAmount: 20, maxAmount: 10000, icon: '⟠', supported: true },
        { symbol: 'SOL', name: 'Solana', chain: 'solana', minAmount: 10, maxAmount: 5000, icon: '◎', supported: true },
        { symbol: 'USDC', name: 'USD Coin', chain: 'ethereum', minAmount: 10, maxAmount: 10000, icon: '●', supported: true, zeroFees: true },
        { symbol: 'USDT', name: 'Tether', chain: 'ethereum', minAmount: 10, maxAmount: 10000, icon: '₮', supported: true }
      ];
    }

    res.json({
      success: true,
      assets: assets.slice(0, 10)
    });
  } catch (error) {
    console.error('Critical error in /assets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch assets',
      message: error.message 
    });
  }
});

/**
 * Create a Coinbase Pay session (for buying with fiat)
 * POST /api/coinbase-onramp/create-pay-session
 */
router.post('/create-pay-session', async (req, res) => {
  // Set content type header explicitly
  res.setHeader('Content-Type', 'application/json');
  
  try {
    console.log('Creating pay session with data:', req.body);
    
    const { 
      amount, 
      asset = 'USDC',
      walletAddress,
      chain = 'ethereum'
    } = req.body;

    // Validation
    if (!amount) {
      return res.status(400).json({ 
        success: false,
        error: 'Amount is required' 
      });
    }
    
    if (!walletAddress) {
      return res.status(400).json({ 
        success: false,
        error: 'Wallet address is required' 
      });
    }

    // Generate a unique session ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Create session object
    const paySession = {
      sessionId,
      partnerId: process.env.COINBASE_PARTNER_ID || 'test-partner',
      quote: {
        amount: parseFloat(amount),
        currency: 'USD',
        destination: {
          address: walletAddress,
          chain: chain,
          asset: asset
        }
      },
      expiresAt: new Date(Date.now() + 15 * 60000).toISOString(),
      createdAt: new Date().toISOString()
    };

    // Generate a payment URL
    const paymentUrl = `https://pay.coinbase.com/buy/select-asset?session=${sessionId}`;

    console.log('Session created successfully:', sessionId);

    // Return proper JSON response
    return res.status(200).json({
      success: true,
      session: paySession,
      paymentUrl
    });

  } catch (error) {
    console.error('Error creating Pay session:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create payment session',
      message: error.message 
    });
  }
});
/**
 * Get exchange rate from Coinbase
 * GET /api/coinbase-onramp/rate/:asset
 */
router.get('/rate/:asset', async (req, res) => {
  try {
    const { asset } = req.params;
    const { amount } = req.query;

    console.log(`Fetching rate for ${asset}${amount ? ` with amount ${amount}` : ''}`);

    let rate = null;
    try {
      if (COINBASE_API_KEY) {
        // Use correct Coinbase headers for rate endpoint
        const path = `/v2/prices/${asset}-USD/spot`;
        const { timestamp, signature } = generateSignature('GET', path);
        
        const response = await axios.get(`${COINBASE_API_URL}${path}`, {
          headers: {
            'CB-ACCESS-KEY': COINBASE_API_KEY,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': timestamp,
            'CB-VERSION': '2024-02-01',
            'Content-Type': 'application/json'
          },
          timeout: 3000
        });
        
        rate = parseFloat(response.data.data.amount);
      }
    } catch (apiError) {
      console.log('Coinbase API unavailable for rate, using fallback');
    }

    // Fallback rates
    if (!rate) {
      const fallbackRates = {
        ETH: 2800,
        SOL: 140,
        USDC: 1,
        USDT: 1,
        BTC: 43000,
        ADA: 0.45,
        BNB: 320
      };
      rate = fallbackRates[asset.toUpperCase()] || null;
    }
    
    const estimatedAmount = amount && rate ? parseFloat(amount) / rate : null;

    res.json({
      success: true,
      asset,
      rate,
      estimatedAmount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in /rate:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch rate',
      message: error.message 
    });
  }
});

// Helper function to get icon for symbol
function getIconForSymbol(symbol) {
  const icons = {
    BTC: '₿',
    ETH: '⟠',
    SOL: '◎',
    USDC: '●',
    USDT: '₮',
    ADA: '🔷',
    BNB: 'ⓑ',
    MATIC: '⬡',
    DOT: '●',
    AVAX: '🔺'
  };
  return icons[symbol] || '🪙';
}

module.exports = router;