const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://libertyx.onrender.com';

class CoinbasePayService {
  // Get supported assets
  async getSupportedAssets() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-onramp/assets`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        console.error('Server response:', text.substring(0, 200));
        throw new Error(`Server error: ${response.status}`);
      }
      
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

  // Create Coinbase Pay session
  async createPaySession(sessionData) {
    try {
      console.log('Sending session data to server:', sessionData);
      
      const response = await fetch(`${API_BASE_URL}/api/coinbase-onramp/create-pay-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(sessionData),
      });

      // Log response status
      console.log('Response status:', response.status);
      
      // Check if response is OK
      if (!response.ok) {
        const text = await response.text();
        console.error('Server error response:', text.substring(0, 500));
        throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log('Session created successfully:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment session');
      }

      return data;
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw error;
    }
  }

  // Keep the alias for backward compatibility
  async createSession(sessionData) {
    return this.createPaySession(sessionData);
  }

  // Get exchange rate
  async getExchangeRate(asset, amount) {
    try {
      const url = amount 
        ? `${API_BASE_URL}/api/coinbase-onramp/rate/${asset}?amount=${amount}`
        : `${API_BASE_URL}/api/coinbase-onramp/rate/${asset}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status}`);
      }

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

  // Get session status
  async getSessionStatus(sessionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-onramp/session/${sessionId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status}`);
      }

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

  // Validate wallet address
  async validateAddress(address, chain) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coinbase-onramp/validate-address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ address, chain }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status}`);
      }

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