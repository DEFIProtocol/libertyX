import React, { useMemo } from 'react';
import { useBinanceWs } from '../contexts/BinanceWsContext';
import { useChainContext } from '../contexts/ChainContext';
import { useTokens } from '../contexts/TokenContext';
import { useGlobalPriceTokens } from '../hooks/useGlobalPriceTokens';
import TokenTable from '../components/Tokens/TokenTable';
import './Tokens.css';

function Tokens() {
  const { isConnected: wsConnected, latestData } = useBinanceWs();
  const { selectedChain, getChainLabel } = useChainContext();
  const { dbTokens } = useTokens();
  const {
    tokens: baseTokens,
    loading: loadingTokens,
    error: tokenError,
    refresh: refreshGlobalTokens
  } = useGlobalPriceTokens();

  const binanceBySymbol = useMemo(() => {
    const map = {};
    if (Array.isArray(latestData)) {
      latestData.forEach((ticker) => {
        if (ticker.s && ticker.c && ticker.s.endsWith('USDT')) {
          const base = ticker.s.replace(/USDT$/i, '').toUpperCase();
          map[base] = ticker;
        }
      });
    }
    return map;
  }, [latestData]);

  // Combine tokens with market data
  const combinedTokens = useMemo(() => {
    if (!baseTokens) return [];

    return baseTokens.map(token => {
      if (!token) return null;

      const symbolKey = token.symbol?.toUpperCase();
      const binanceTicker = symbolKey ? binanceBySymbol[symbolKey] : null;
      const binancePrice = binanceTicker?.c ? parseFloat(binanceTicker.c) : null;

      const price = binancePrice ?? (token.price ? parseFloat(token.price) : null);
      const change = binanceTicker?.P ? parseFloat(binanceTicker.P) : null;

      return {
        ...token,
        price: price !== null ? price.toString() : '0',
        change: change !== null ? change.toString() : token.change?.toString() || '0',
        marketCap: token.marketCap || token.market_cap || '0'
      };
    }).filter(token => token !== null);
  }, [baseTokens, binanceBySymbol]);

  const chainTokenCount = useMemo(() => {
    const chainKeyMap = {
      '1': ['ethereum'],
      '56': ['bnb', 'bsc'],
      '137': ['polygon'],
      '43114': ['avalanche'],
      '42161': ['arbitrum'],
      '501': ['solana']
    };

    const normalizeChains = (rawChains) => {
      if (!rawChains) return {};
      if (typeof rawChains === 'string') {
        try {
          return JSON.parse(rawChains);
        } catch (e) {
          return {};
        }
      }
      return rawChains || {};
    };

    const sourceTokens = (Array.isArray(dbTokens) && dbTokens.length) ? dbTokens : combinedTokens;
    const chainKey = String(selectedChain || '');
    const aliasKeys = chainKeyMap[chainKey] || [];

    return (sourceTokens || []).filter((token) => {
      if (!token?.uuid) return false;
      const chains = normalizeChains(token?.chains);
      return !!(chains?.[chainKey] || aliasKeys.some((key) => chains?.[key]));
    }).length;
  }, [dbTokens, combinedTokens, selectedChain]);

  
  // Refresh all data
  const handleRefreshAll = async () => {
    try {
      await fetch(`${process.env.REACT_APP_API_BASE_URL}/global-prices/refresh-rapidapi`, { method: 'POST' });
    } catch (error) {
      // ignore refresh errors; still refetch tokens
    }
    await refreshGlobalTokens();
  };
  
  // Get loading state
  const isLoading = loadingTokens;
  
  return (
    <div className="tokens-page">
      {/* Header */}
      <div className="tokens-header">
        <div>
          <h1>Tokens</h1>
          <p className="subtitle">
            {isLoading
              ? 'Loading...'
              : `Current Chain: ${getChainLabel?.(selectedChain) || selectedChain} (${chainTokenCount})`}
          </p>
          {!isLoading && (
            <p className="subtitle">Switch chains for different tokens!</p>
          )}
        </div>
        
        <div className="header-actions">
          <button 
            className="refresh-button"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Loading...' : '↻ Refresh All'}
          </button>
        </div>
      </div>
      
      
      {/* Main Content */}
      <div className="tokens-content">
        {isLoading && combinedTokens.length === 0 ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading tokens and market data...</p>
            <p className="loading-details">
              Streaming {combinedTokens.length} token prices
            </p>
          </div>
        ) : (
          <TokenTable 
            tokens={combinedTokens} 
            loading={isLoading} 
          />
        )}
      </div>
      
      {/* Footer Info */}
      <div className="tokens-footer">
        <p>
          <strong>Data Sources:</strong> Token data from your database/JSON • 
          Live prices from Binance
        </p>
        <div className="footer-details">
          <span className="timestamp">
            Last update: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="api-status">
            API Status: {wsConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>
        {tokenError && (
          <p className="error-text">Error loading tokens: {tokenError}</p>
        )}
      </div>
    </div>
  );
}

export default Tokens;