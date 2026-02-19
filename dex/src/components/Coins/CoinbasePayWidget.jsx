import React, { useState, useEffect } from 'react';
import CoinbasePayService from '../../services/CoinbasePayService';
import { useAccount } from 'wagmi';
import { useChainContext } from '../../contexts/ChainContext';
import './CoinbasePayWidget.css';

function CoinbasePayWidget() {
  const { address, isConnected } = useAccount();
  const { selectedChain, getChainLabel, availableChains } = useChainContext();
  const [step, setStep] = useState('select'); // select, processing, complete
  const [selectedAsset, setSelectedAsset] = useState('USDC');
  const [amount, setAmount] = useState('100');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rate, setRate] = useState(null);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);

  // Get current chain label
  const currentChainLabel = getChainLabel(selectedChain) || 'Ethereum';
  
  // Map chain ID to chain name for Coinbase
  const getChainNameForCoinbase = (chainId) => {
    const chainMap = {
      '1': 'ethereum',
      '56': 'bnb',
      '137': 'polygon',
      '43114': 'avalanche',
      '42161': 'arbitrum',
      '501': 'solana'
    };
    return chainMap[chainId] || 'ethereum';
  };

  // Determine if selected asset is available on current chain
  const isAssetAvailableOnChain = (asset) => {
    const currentChain = getChainNameForCoinbase(selectedChain);
    
    // Asset chain compatibility
    const assetChains = {
      'ETH': ['ethereum', 'arbitrum', 'polygon', 'avalanche'],
      'SOL': ['solana'],
      'USDC': ['ethereum', 'polygon', 'avalanche', 'arbitrum', 'solana'],
      'USDT': ['ethereum', 'polygon', 'avalanche', 'arbitrum'],
      'BTC': [], // Bitcoin not supported on EVM chains
      'ADA': [], // Cardano not supported
      'BNB': ['bnb']
    };
    
    return assetChains[asset]?.includes(currentChain) || false;
  };

  // Fetch supported assets on mount
  useEffect(() => {
    loadAssets();
  }, []);

  // Fetch exchange rate when asset or amount changes
  useEffect(() => {
    if (selectedAsset && amount) {
      loadExchangeRate();
    }
  }, [selectedAsset, amount]);

  const loadAssets = async () => {
    try {
      const data = await CoinbasePayService.getSupportedAssets();
      setAssets(data);
    } catch (err) {
      setError('Failed to load assets');
    }
  };

  const loadExchangeRate = async () => {
    try {
      const data = await CoinbasePayService.getExchangeRate(selectedAsset, amount);
      setRate(data);
    } catch (err) {
      console.error('Rate fetch failed:', err);
    }
  };

  const handleCreateSession = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sessionData = {
        asset: selectedAsset,
        amount: parseFloat(amount),
        walletAddress: address,
        chain: getChainNameForCoinbase(selectedChain)
      };

      const response = await CoinbasePayService.createSession(sessionData);
      setSession(response.session);
      
      // Redirect to Coinbase
      window.open(response.paymentUrl, '_blank');
      setStep('processing');
      
    } catch (err) {
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  // If using redirect approach, render this
  if (step === 'processing' && session) {
    return (
      <div className="cb-pay-processing">
        <div className="processing-spinner"></div>
        <h3>Redirecting to Coinbase...</h3>
        <p>Your purchase session has been created.</p>
        <p className="chain-notice">
          💰 These funds will be added to your <strong>{currentChainLabel}</strong> wallet
        </p>
        <button 
          className="cb-button"
          onClick={() => window.open(session.paymentUrl, '_blank')}
        >
          Open Coinbase Pay
        </button>
        <button 
          className="cb-button secondary"
          onClick={() => setStep('select')}
        >
          Cancel
        </button>
      </div>
    );
  }

  // Filter assets based on current chain
  const availableAssets = assets.filter(asset => 
    isAssetAvailableOnChain(asset.symbol)
  );

  return (
    <div className="cb-pay-widget">
      <div className="cb-header">
        <h2>Add Funds with Coinbase</h2>
        <p className="cb-subtitle">Zero fees on USDC purchases</p>
      </div>

      {/* Chain Context Banner */}
      <div className="chain-context-banner">
        <div className="chain-info">
          <span className="chain-icon">⛓️</span>
          <div className="chain-details">
            <strong>Current Network: {currentChainLabel}</strong>
            <p className="chain-message">
              These funds will be added to your {currentChainLabel} wallet at:
              <br />
              <span className="wallet-address">
                {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'}
              </span>
            </p>
          </div>
        </div>
        <div className="chain-switch-notice">
          <span className="switch-icon">🔄</span>
          <span>
            Switch chains in the header to add funds to a different network
          </span>
        </div>
      </div>

      {error && (
        <div className="cb-error">
          ⚠️ {error}
        </div>
      )}

      {/* Asset Selection - Only show assets available on current chain */}
      <div className="cb-section">
        <label className="cb-label">Select Asset for {currentChainLabel}</label>
        {availableAssets.length > 0 ? (
          <div className="asset-grid">
            {availableAssets.map((asset) => (
              <button
                key={asset.symbol}
                className={`asset-option ${selectedAsset === asset.symbol ? 'selected' : ''}`}
                onClick={() => setSelectedAsset(asset.symbol)}
              >
                <span className="asset-icon">{asset.icon}</span>
                <span className="asset-symbol">{asset.symbol}</span>
                <span className="asset-name">{asset.name}</span>
                {asset.zeroFees && (
                  <span className="fee-badge">0 Fees</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="no-assets-warning">
            ⚠️ No assets available for {currentChainLabel}. Try switching chains.
          </div>
        )}
      </div>

      {/* Amount Input */}
      <div className="cb-section">
        <label className="cb-label">Amount (USD)</label>
        <div className="amount-input-wrapper">
          <span className="currency-symbol">$</span>
          <input
            type="number"
            className="amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="10"
            max="10000"
            step="10"
            placeholder="Enter amount"
          />
        </div>

        {/* Preset amounts */}
        <div className="preset-amounts">
          {[50, 100, 250, 500, 1000].map((preset) => (
            <button
              key={preset}
              className={`preset-btn ${parseFloat(amount) === preset ? 'active' : ''}`}
              onClick={() => setAmount(preset.toString())}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {/* Estimated Receive */}
      {rate && (
        <div className="cb-section estimate">
          <div className="estimate-row">
            <span>You pay:</span>
            <span className="estimate-value">${amount} USD</span>
          </div>
          <div className="estimate-row">
            <span>You receive ≈</span>
            <span className="estimate-value highlight">
              {rate.estimatedAmount?.toFixed(6)} {selectedAsset}
            </span>
          </div>
          <div className="estimate-row">
            <span>Rate:</span>
            <span className="estimate-value">1 {selectedAsset} = ${rate.rate?.toFixed(2)}</span>
          </div>
          <div className="estimate-row">
            <span>Network:</span>
            <span className="estimate-value">{currentChainLabel}</span>
          </div>
          <div className="estimate-row fee-row">
            <span>Coinbase fee:</span>
            <span className="estimate-value">{selectedAsset === 'USDC' ? '$0' : '$2.99'}</span>
          </div>
        </div>
      )}

      {/* Wallet Connection Warning */}
      {!isConnected && (
        <div className="wallet-warning">
          <span>🔌</span>
          <span>Connect wallet to continue</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="cb-actions">
        <button
          className="cb-button primary"
          onClick={handleCreateSession}
          disabled={!isConnected || loading || !amount || parseFloat(amount) < 10 || availableAssets.length === 0}
        >
          {loading ? 'Creating Session...' : 'Continue to Coinbase'}
        </button>
        <button
          className="cb-button secondary"
          onClick={() => setStep('select')}
        >
          Cancel
        </button>
      </div>

      {/* Security Notice */}
      <div className="security-notice">
        <span>🔒</span>
        <span>Secure payment processed by Coinbase. Your funds are safe.</span>
      </div>
    </div>
  );
}

export default CoinbasePayWidget;