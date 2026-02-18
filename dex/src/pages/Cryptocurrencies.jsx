import React from 'react';
import { useBinanceWs } from '../contexts/BinanceWsContext';
import { useChainContext } from '../contexts/ChainContext';
import { useRapidApi } from '../contexts/RapidApiContext';
import { useGlobalPrices } from '../contexts/GlobalPriceContext';
import CoinsTable from '../components/Coins/CoinsTable';
import './Tokens.css';

function Cryptocurrencies() {
  const { isConnected: wsConnected } = useBinanceWs();
  const { selectedChain, getChainLabel } = useChainContext();
  const { loading: rapidLoading } = useRapidApi();
  const { loading: pricesLoading } = useGlobalPrices();

  // Define the specific tokens we want to display
  const DESIRED_TOKENS = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'ADA', 'BNB'];
  
  // Get token count for current chain
  const chainTokenCount = DESIRED_TOKENS.length;
  
  // Refresh all data
  const handleRefreshAll = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/global-prices/refresh-rapidapi`, { 
        method: 'POST' 
      });
    } catch (error) {
      console.error('Error refreshing prices:', error);
    }
  };
  
  // Get loading state
  const isLoading = rapidLoading || pricesLoading;
  
  return (
    <div className="tokens-page">
      {/* Header */}
      <div className="tokens-header">
        <div>
          <h1>Cryptocurrencies</h1>
          <p className="subtitle">
            {isLoading
              ? 'Loading...'
              : `Current Chain: ${getChainLabel?.(selectedChain) || selectedChain} (${chainTokenCount} tokens)`}
          </p>
          {!isLoading && (
            <p className="subtitle">Top 7 cryptocurrencies by market cap</p>
          )}
        </div>
        
        <div className="header-actions">
          <button 
            className="refresh-button"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Loading...' : '↻ Refresh Prices'}
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="tokens-content">
        <CoinsTable />
      </div>
      
      {/* Footer Info */}
      <div className="tokens-footer">
        <p>
          <strong>Data Sources:</strong> Token info from RapidAPI • 
          Live prices from {wsConnected ? 'Binance WebSocket' : 'Coinbase/RapidAPI'}
        </p>
        <div className="footer-details">
          <span className="timestamp">
            Last update: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="api-status">
            WebSocket: {wsConnected ? '🟢 Connected' : '🔴 Connecting...'}
          </span>
          <span className="api-status" style={{ marginLeft: '15px' }}>
            RapidAPI: {rapidLoading ? '⏳ Loading' : '✅ Loaded'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Cryptocurrencies;