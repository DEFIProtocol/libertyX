import React, { useState, useMemo, useEffect } from 'react';
import { useTokens } from '../contexts/TokenContext';
import { useGetCryptosQuery } from '../hooks';
import TokenTable from '../components/Tokens/TokenTable';
import './Tokens.css';

function Tokens() {
  // Get tokens from context
  const { 
    displayTokens: contextTokens, 
    loadingAll, 
    comparisonMode,
    toggleComparisonMode,
    comparisonStats,
    refreshAll
  } = useTokens();
  
  // Get ALL coins from RapidAPI using new hook
  const { 
    data: marketData, 
    isFetching: loadingMarket,
    refetch: refetchMarketData 
  } = useGetCryptosQuery(1200); // Get 1200 coins
  
  // Extract coins array from market data
  const marketCoins = useMemo(() => {
    return marketData?.data?.coins || [];
  }, [marketData]);
  
  // Get UUIDs from our tokens
  const tokenUuids = useMemo(() => {
    if (!contextTokens) return [];
    
    return contextTokens.map(token => {
      if (comparisonMode) {
        // In comparison mode, get UUID from database or JSON
        return token.database?.uuid || token.json?.uuid;
      } else {
        // In normal mode, just get UUID from token
        return token.uuid;
      }
    }).filter(uuid => uuid); // Remove undefined
  }, [contextTokens, comparisonMode]);

  // Local state for price refresh
  const [priceRefreshKey, setPriceRefreshKey] = useState(0);
  
  // Combine tokens with market data
  const combinedTokens = useMemo(() => {
    if (!contextTokens) return [];
    
    return contextTokens.map(token => {
      // Handle comparison mode vs normal mode
      let tokenData;
      if (comparisonMode) {
        // In comparison mode, use database token if available, otherwise JSON
        tokenData = token.database || token.json;
      } else {
        // In normal mode, just use the token data
        tokenData = token;
      }
      
      if (!tokenData) return null;
      
      // Also try to find in the full market data (for additional info)
      const fullMarketCoin = marketCoins.find(coin => coin.uuid === tokenData.uuid);
      
      return {
        // Base token data
        ...tokenData,
        uuid: tokenData.uuid,
        symbol: tokenData.symbol || token.symbol,
        name: tokenData.name || token.symbol,
        image: tokenData.image,
        addresses: tokenData.addresses,
        type: tokenData.type,
        decimals: tokenData.decimals,
        
        // Price data from market data
        price: fullMarketCoin?.price || '0',
        marketCap: fullMarketCoin?.marketCap || '0',
        change: fullMarketCoin?.change || '0',
        rank: fullMarketCoin?.rank || 9999,
        sparkline: fullMarketCoin?.sparkline,
        iconUrl: fullMarketCoin?.iconUrl || tokenData.image,
        
        // For comparison mode
        inDatabase: comparisonMode ? token.inDatabase : true,
        inJson: comparisonMode ? token.inJson : false,
        isMatch: comparisonMode ? token.match : true
      };
    }).filter(token => token !== null);
  }, [contextTokens, marketCoins, comparisonMode, priceRefreshKey]);
  
  // Refresh all data
  const handleRefreshAll = async () => {
    // Refresh token data from context
    await refreshAll();
    // Refresh market data
    refetchMarketData();
    // Force re-render
    setPriceRefreshKey(prev => prev + 1);
  };
  
  // Get loading state
  const isLoading = loadingAll || loadingMarket;
  
  // Get tokens with market data
  const tokensWithMarketData = useMemo(() => {
    return combinedTokens.filter(token => token.price && token.price !== '0');
  }, [combinedTokens]);
  
  // Calculate total market cap
  const totalMarketCap = useMemo(() => {
    return tokensWithMarketData.reduce((sum, token) => {
      return sum + (parseFloat(token.marketCap) || 0);
    }, 0);
  }, [tokensWithMarketData]);
  
  return (
    <div className="tokens-page">
      {/* Header */}
      <div className="tokens-header">
        <div>
          <h1>Tokens Dashboard</h1>
          <p className="subtitle">
            {isLoading ? 'Loading...' : `${combinedTokens.length} tokens with real-time prices`}
          </p>
        </div>
        
        <div className="header-actions">
          <button 
            className={`mode-toggle ${comparisonMode ? 'active' : ''}`}
            onClick={toggleComparisonMode}
            disabled={isLoading}
          >
            {comparisonMode ? '🔄 Comparison Mode' : '📊 Normal Mode'}
          </button>
          <button 
            className="refresh-button"
            onClick={handleRefreshAll}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Loading...' : '↻ Refresh All'}
          </button>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-value">{combinedTokens.length}</div>
          <div className="stat-label">Total Tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tokensWithMarketData.length}</div>
          <div className="stat-label">With Prices</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            ${(totalMarketCap / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 })}B
          </div>
          <div className="stat-label">Total Market Cap</div>
        </div>
        {comparisonMode && (
          <>
            <div className="stat-card">
              <div className="stat-value">{comparisonStats.inBoth}</div>
              <div className="stat-label">In Both Sources</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{comparisonStats.matching}</div>
              <div className="stat-label">Perfect Matches</div>
            </div>
          </>
        )}
      </div>
      
      {/* Comparison Stats - Only show in comparison mode */}
      {comparisonMode && (
        <div className="comparison-details">
          <h3>Data Source Comparison</h3>
          <div className="comparison-grid">
            <div className="comparison-item">
              <span className="label">Only in Database:</span>
              <span className="value">{comparisonStats.onlyInDb}</span>
            </div>
            <div className="comparison-item">
              <span className="label">Only in JSON:</span>
              <span className="value">{comparisonStats.onlyInJson}</span>
            </div>
            <div className="comparison-item">
              <span className="label">Different Data:</span>
              <span className="value">{comparisonStats.different}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="tokens-content">
        {isLoading && combinedTokens.length === 0 ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading tokens and market data...</p>
            <p className="loading-details">
              Fetching {tokenUuids.length} token prices from RapidAPI
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
          Real-time prices from CoinRanking API via RapidAPI
        </p>
        <div className="footer-details">
          <span className="timestamp">
            Last update: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="api-status">
            API Status: {marketData ? 'Connected' : 'Connecting...'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default Tokens;