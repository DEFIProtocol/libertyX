const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://libertyx.onrender.com';

class CoinbasePayService {
  // Get supported assets
  async getSupportedAssets() {
    try {
      const response = await fetch(`${API_BASE_URL}/coinbase-onramp/assets`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch assets');
      }
      
      return data.assets;
    } catch (error) {
      console.error('Error fetching assets:', error);
      throw error;
    }
  }

  // Create Coinbase Pay session (UPDATED to match backend)
  async createPaySession(sessionData) {
    try {
      const response = await fetch(`${API_BASE_URL}/coinbase-onramp/create-pay-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment session');
      }

      return data;
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw error;
    }
  }

  // Keep the old method name for backward compatibility if needed
  async createSession(sessionData) {
    return this.createPaySession(sessionData);
  }

  // Get session status
  async getSessionStatus(sessionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/coinbase-onramp/session/${sessionId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch session');
      }

      return data.session;
    } catch (error) {
      console.error('Error fetching session:', error);
      throw error;
    }
  }

  // Get exchange rate
  async getExchangeRate(asset, amount) {
    try {
      const url = amount 
        ? `${API_BASE_URL}/coinbase-onramp/rate/${asset}?amount=${amount}`
        : `${API_BASE_URL}/coinbase-onramp/rate/${asset}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch rate');
      }

      return data;
    } catch (error) {
      console.error('Error fetching rate:', error);
      throw error;
    }
  }

  // Validate wallet address
  async validateAddress(address, chain) {
    try {
      const response = await fetch(`${API_BASE_URL}/coinbase-onramp/validate-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address, chain }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to validate address');
      }

      return data;
    } catch (error) {
      console.error('Error validating address:', error);
      throw error;
    }
  }
}

export default new CoinbasePayService();