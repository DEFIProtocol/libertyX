import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import './OnrampModal.css';

function OnrampModal({ isOpen, onClose }) {
  const { isConnected } = useAccount();
  const [selectedAsset, setSelectedAsset] = useState('ETH');
  const [amount, setAmount] = useState('100');
  const [step, setStep] = useState(1); // 1: asset selection, 2: amount, 3: preview

  const assets = [
    { 
      symbol: 'ETH', 
      name: 'Ethereum', 
      icon: '⟠', 
      color: '#627EEA',
      chain: 'Ethereum',
      min: '50',
      max: '10000'
    },
    { 
      symbol: 'SOL', 
      name: 'Solana', 
      icon: '◎', 
      color: '#9945FF',
      chain: 'Solana',
      min: '20',
      max: '5000'
    },
    { 
      symbol: 'USDC', 
      name: 'USD Coin', 
      icon: '●', 
      color: '#2775CA',
      chain: 'Multi-Chain',
      min: '20',
      max: '10000'
    },
    { 
      symbol: 'USDT', 
      name: 'Tether', 
      icon: '₮', 
      color: '#26A17B',
      chain: 'Multi-Chain',
      min: '20',
      max: '10000'
    }
  ];

  const presetAmounts = [50, 100, 250, 500, 1000];

  const selectedAssetData = assets.find(a => a.symbol === selectedAsset);

  const handleContinue = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleBuy = () => {
    // This will be connected to Coinbase Onramp later
    console.log('Buying:', { asset: selectedAsset, amount });
    alert(`🚀 This will connect to Coinbase Onramp to buy ${amount} ${selectedAsset}`);
    onClose();
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <div className="onramp-modal-overlay" onClick={onClose}>
      <div className="onramp-modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="onramp-modal-header">
          <h2>Add Funds to Wallet</h2>
          <button className="onramp-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Progress Steps */}
        <div className="onramp-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Select Asset</span>
          </div>
          <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Enter Amount</span>
          </div>
          <div className={`progress-line ${step >= 3 ? 'active' : ''}`}></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Preview</span>
          </div>
        </div>

        {/* Wallet Connection Warning */}
        {!isConnected && (
          <div className="wallet-warning">
            <span className="warning-icon">⚠️</span>
            <span>Connect your wallet to complete purchase</span>
            <button className="connect-prompt-btn">Connect Now</button>
          </div>
        )}

        {/* Step 1: Asset Selection */}
        {step === 1 && (
          <div className="step-content">
            <p className="step-description">Choose the asset you want to purchase</p>
            <div className="asset-grid">
              {assets.map((asset) => (
                <button
                  key={asset.symbol}
                  className={`asset-card ${selectedAsset === asset.symbol ? 'selected' : ''}`}
                  onClick={() => setSelectedAsset(asset.symbol)}
                >
                  <div className="asset-icon" style={{ backgroundColor: `${asset.color}20`, color: asset.color }}>
                    {asset.icon}
                  </div>
                  <div className="asset-info">
                    <span className="asset-symbol">{asset.symbol}</span>
                    <span className="asset-name">{asset.name}</span>
                  </div>
                  <div className="asset-chain">{asset.chain}</div>
                  {selectedAsset === asset.symbol && (
                    <div className="selected-check">✓</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Amount Selection */}
        {step === 2 && selectedAssetData && (
          <div className="step-content">
            <p className="step-description">
              Enter amount in USD (min: ${selectedAssetData.min}, max: ${selectedAssetData.max})
            </p>
            
            <div className="amount-input-container">
              <input
                type="number"
                className="amount-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={selectedAssetData.min}
                max={selectedAssetData.max}
                step="10"
              />
              <span className="amount-currency">USD</span>
            </div>

            <div className="preset-amounts">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  className={`preset-amount ${parseFloat(amount) === preset ? 'active' : ''}`}
                  onClick={() => setAmount(preset.toString())}
                >
                  ${preset}
                </button>
              ))}
            </div>

            <div className="estimated-receive">
              <span>You'll receive approximately:</span>
              <span className="estimated-amount">
                {selectedAsset.symbol === 'USDC' || selectedAsset.symbol === 'USDT' 
                  ? `${amount} ${selectedAsset.symbol}`
                  : `~${(parseFloat(amount) / (selectedAsset.symbol === 'ETH' ? 2800 : 140)).toFixed(4)} ${selectedAsset.symbol}`
                }
              </span>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && selectedAssetData && (
          <div className="step-content">
            <p className="step-description">Review your purchase</p>
            
            <div className="preview-card">
              <div className="preview-row">
                <span>You pay:</span>
                <span className="preview-amount">${amount} USD</span>
              </div>
              <div className="preview-row">
                <span>You receive:</span>
                <span className="preview-amount highlight">
                  {selectedAsset.symbol === 'USDC' || selectedAsset.symbol === 'USDT' 
                    ? `${amount} ${selectedAsset.symbol}`
                    : `~${(parseFloat(amount) / (selectedAsset.symbol === 'ETH' ? 2800 : 140)).toFixed(4)} ${selectedAsset.symbol}`
                  }
                </span>
              </div>
              <div className="preview-row">
                <span>Network:</span>
                <span>{selectedAssetData.chain}</span>
              </div>
              <div className="preview-row">
                <span>Estimated gas:</span>
                <span>~$2.50</span>
              </div>
              <div className="preview-divider"></div>
              <div className="preview-row total">
                <span>Total (including fees):</span>
                <span>${(parseFloat(amount) + 2.5).toFixed(2)} USD</span>
              </div>
            </div>

            <div className="fee-notice">
              <span className="fee-icon">ℹ️</span>
              <span>Powered by Coinbase. Zero fees on USDC purchases!</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="modal-actions">
          {step > 1 && (
            <button className="modal-btn secondary" onClick={handleBack}>
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button 
              className="modal-btn primary" 
              onClick={handleContinue}
              disabled={!isConnected}
            >
              Continue →
            </button>
          ) : (
            <button 
              className="modal-btn primary buy-btn" 
              onClick={handleBuy}
              disabled={!isConnected}
            >
              💳 Buy with Coinbase
            </button>
          )}
        </div>

        {/* Security Notice */}
        <div className="security-notice">
          <span>🔒</span>
          <span>Secure transaction powered by Coinbase. Your funds are safe.</span>
        </div>
      </div>
    </div>
  );
}

export default OnrampModal;