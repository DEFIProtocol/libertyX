const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');

// Coinbase API configuration
const COINBASE_API_KEY = process.env.COINBASE_API;
const COINBASE_API_SECRET = process.env.COINBASE_API_SECRET;
const COINBASE_PAY_API_URL = 'https://pay.coinbase.com/api/v1';

/**
 * Generate Coinbase API signature for authenticated requests
 */
const generateSignature = (method, path, body = '') => {
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
};

/**
 * Get supported assets from Coinbase
 * GET /api/coinbase-onramp/assets
 */
router.get('/assets', async (req, res) => {
  try {
    // Call Coinbase API to get supported assets
    const response = await axios.get(`${COINBASE_PAY_API_URL}/currencies`, {
      headers: {
        'X-CC-Api-Key': COINBASE_API_KEY,
        'X-CC-Version': '2018-03-22'
      }
    });

    // Transform Coinbase response to our format
    const assets = response.data.data
      .filter(currency => currency.type === 'crypto')
      .map(currency => ({
        symbol: currency.code,
        name: currency.name,
        chain: currency.networks?.[0] || 'ethereum',
        minAmount: currency.min_amount || 10,
        maxAmount: currency.max_amount || 10000,
        icon: getIconForSymbol(currency.code),
        supported: true,
        zeroFees: currency.code === 'USDC' // USDC often has zero fees
      }));

    res.json({
      success: true,
      assets: assets.slice(0, 10) // Limit to top 10 for now
    });
  } catch (error) {
    console.error('Error fetching assets from Coinbase:', error.response?.data || error.message);
    
    // Fallback to static list if API fails
    const fallbackAssets = [
      { symbol: 'ETH', name: 'Ethereum', chain: 'ethereum', minAmount: 20, maxAmount: 10000, icon: '⟠', supported: true },
      { symbol: 'SOL', name: 'Solana', chain: 'solana', minAmount: 10, maxAmount: 5000, icon: '◎', supported: true },
      { symbol: 'USDC', name: 'USD Coin', chain: 'ethereum', minAmount: 10, maxAmount: 10000, icon: '●', supported: true, zeroFees: true },
      { symbol: 'USDT', name: 'Tether', chain: 'ethereum', minAmount: 10, maxAmount: 10000, icon: '₮', supported: true }
    ];
    
    res.json({
      success: true,
      assets: fallbackAssets,
      fromCache: true
    });
  }
});

/**
 * Create a new Coinbase Charge (for Commerce)
 * POST /api/coinbase-onramp/create-charge
 */
router.post('/create-charge', async (req, res) => {
  try {
    const { 
      amount, 
      currency = 'USD',
      asset = 'USDC',
      walletAddress,
      metadata = {}
    } = req.body;

    // Validation
    if (!amount || !walletAddress) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount, walletAddress' 
      });
    }

    // Create a charge with Coinbase Commerce
    const chargeData = {
      name: 'LibertyX Wallet Funding',
      description: `Add ${amount} ${currency} to your LibertyX wallet`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: amount.toString(),
        currency: currency
      },
      metadata: {
        wallet_address: walletAddress,
        asset: asset,
        ...metadata
      },
      redirect_url: `${process.env.FRONTEND_URL}/account?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/account?cancelled=true`
    };

    const { timestamp, signature } = generateSignature(
      'POST', 
      '/charges', 
      JSON.stringify(chargeData)
    );

    const response = await axios.post(`${COINBASE_COMMERCE_API_URL}/charges`, chargeData, {
      headers: {
        'X-CC-Api-Key': COINBASE_API_KEY,
        'X-CC-Version': '2018-03-22',
        'CB-VERSION': '2018-03-22'
      }
    });

    const charge = response.data.data;

    // Store charge in your database
    // await storeChargeInDatabase(charge);

    res.json({
      success: true,
      charge: {
        id: charge.id,
        code: charge.code,
        hostedUrl: charge.hosted_url,
        expiresAt: charge.expires_at,
        pricing: charge.pricing,
        walletAddress
      }
    });

  } catch (error) {
    console.error('Error creating Coinbase charge:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to create charge',
      details: error.response?.data || error.message 
    });
  }
});

/**
 * Create a Coinbase Pay session (for buying with fiat)
 * POST /api/coinbase-onramp/create-pay-session
 */
router.post('/create-pay-session', async (req, res) => {
  try {
    const { 
      amount, 
      asset = 'USDC',
      walletAddress,
      chain = 'ethereum'
    } = req.body;

    // Generate a unique session ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    // For Coinbase Pay, you'd typically generate a JWT or session token
    // This is a simplified example - actual implementation depends on Coinbase Pay's API
    const paySession = {
      sessionId,
      partnerId: process.env.COINBASE_PARTNER_ID,
      quote: {
        amount: amount,
        currency: 'USD',
        destination: {
          address: walletAddress,
          chain: chain,
          asset: asset
        }
      },
      expiresAt: new Date(Date.now() + 15 * 60000).toISOString()
    };

    // Store session in database
    // await storePaySession(sessionId, paySession);

    // Generate a payment URL (this would be from Coinbase)
    const paymentUrl = `https://pay.coinbase.com/buy/select-asset?session=${sessionId}`;

    res.json({
      success: true,
      session: paySession,
      paymentUrl
    });

  } catch (error) {
    console.error('Error creating Pay session:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
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

    // Get real exchange rate from Coinbase
    const response = await axios.get(
      `${COINBASE_API_URL}/v2/prices/${asset}-USD/spot`
    );

    const rate = parseFloat(response.data.data.amount);
    
    const estimatedAmount = amount ? parseFloat(amount) / rate : null;

    res.json({
      success: true,
      asset,
      rate,
      estimatedAmount,
      timestamp: new Date().toISOString(),
      source: 'coinbase-api'
    });

  } catch (error) {
    console.error('Error fetching rate:', error);
    
    // Fallback rates
    const fallbackRates = {
      ETH: 2800,
      SOL: 140,
      USDC: 1,
      USDT: 1
    };

    const rate = fallbackRates[asset.toUpperCase()] || null;
    const estimatedAmount = amount && rate ? parseFloat(amount) / rate : null;

    res.json({
      success: true,
      asset,
      rate,
      estimatedAmount,
      fromCache: true,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Webhook handler for Coinbase events
 * POST /api/coinbase-onramp/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-cc-webhook-signature'];
    const payload = req.body;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.COINBASE_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    console.log('Coinbase webhook received:', payload.event.type);

    // Handle different event types
    switch (payload.event.type) {
      case 'charge:confirmed':
        // Payment successful - credit user's account
        const { wallet_address, asset } = payload.event.data.metadata;
        const amount = payload.event.data.pricing.local.amount;
        
        // Update user balance in database
        await creditUserBalance(wallet_address, asset, amount);
        
        // Emit websocket event to frontend
        // ws.emit('funds-added', { wallet_address, amount, asset });
        break;
      
      case 'charge:failed':
        // Handle failure
        console.log('Charge failed:', payload.event.data);
        break;
      
      case 'charge:pending':
        console.log('Charge pending:', payload.event.data);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
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

// Helper function to credit user balance
async function creditUserBalance(walletAddress, asset, amount) {
  // Implement your database logic here
  console.log(`Crediting ${amount} ${asset} to ${walletAddress}`);
  // await db.query('UPDATE users SET balance = balance + $1 WHERE wallet = $2', [amount, walletAddress]);
}

module.exports = router;