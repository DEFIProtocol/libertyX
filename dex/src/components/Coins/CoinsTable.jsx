import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { useRapidApi } from '../../contexts/RapidApiContext';
import { useChainContext } from '../../contexts/ChainContext';
import { useBinanceWs } from '../../contexts/BinanceWsContext';
import { useGlobalPrices } from '../../contexts/GlobalPriceContext';
import { useUserContext } from '../../contexts/UserContext';
import '../Tokens/token-table.css';

function CoinsTable() {
  const navigate = useNavigate();
  const { coins, loading: rapidLoading } = useRapidApi();
  const { latestData } = useBinanceWs();
  const { prices: globalPrices } = useGlobalPrices();
  const { selectedChain } = useChainContext();
  const { isInWatchlist, toggleWatchlistToken } = useUserContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Define the specific tokens we want to display in order
  const DESIRED_TOKENS = ['BTC', 'ETH', 'SOL', 'USDT', 'USDC', 'ADA', 'BNB'];
  
  // Map for token name overrides (for display names)
  const TOKEN_NAME_OVERRIDES = {
    'ADA': 'Cardano'
  };

  // Map for token icons (using reliable CDN)
  const TOKEN_ICONS = {
    'BTC': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
    'ETH': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
    'SOL': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/sol.png',
    'USDT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdt.png',
    'USDC': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/usdc.png',
    'ADA': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ada.png',
    'BNB': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png'
  };

  // Create a map of coins from RapidAPI by symbol
  const rapidBySymbol = useMemo(() => {
    const map = {};
    (coins || []).forEach((coin) => {
      if (coin?.symbol) {
        map[coin.symbol.toUpperCase()] = coin;
      }
    });
    return map;
  }, [coins]);

  // Create a map of Binance tickers by symbol
  const binanceBySymbol = useMemo(() => {
    const map = {};
    if (Array.isArray(latestData)) {
      latestData.forEach((ticker) => {
        if (ticker?.s && ticker.s.endsWith('USDT')) {
          const base = ticker.s.replace(/USDT$/i, '').toUpperCase();
          map[base] = ticker;
        }
      });
    }
    return map;
  }, [latestData]);

  // Build our tokens array from RapidAPI data
  const tokens = useMemo(() => {
    return DESIRED_TOKENS
      .map((symbol) => {
        // Get data from RapidAPI
        const rapidCoin = rapidBySymbol[symbol];
        
        // Get Binance ticker data
        const binanceTicker = binanceBySymbol[symbol];
        const binancePrice = binanceTicker?.c ? parseFloat(binanceTicker.c) : null;
        
        // Get global price data
        const priceEntry = globalPrices?.[symbol] || null;
        const coinbasePrice = priceEntry?.coinbasePrice ?? null;
        const rapidPrice = priceEntry?.rapidPrice ?? (rapidCoin?.price ? parseFloat(rapidCoin.price) : null);
        
        // Resolve price (priority: Binance > Coinbase > RapidAPI)
        const resolvedPrice = binancePrice ?? coinbasePrice ?? rapidPrice ?? null;
        
        // Resolve market cap and change
        const resolvedMarketCap = 
          priceEntry?.marketCap ??
          priceEntry?.coinData?.marketCap ??
          (rapidCoin?.marketCap ? parseFloat(rapidCoin.marketCap) : null);
          
        const resolvedChange = 
          priceEntry?.change ??
          priceEntry?.coinData?.change ??
          (rapidCoin?.change ? parseFloat(rapidCoin.change) : null);

        // Build the token object
        return {
          uuid: rapidCoin?.uuid || `${symbol.toLowerCase()}-token`,
          symbol: symbol,
          name: TOKEN_NAME_OVERRIDES[symbol] || rapidCoin?.name || symbol,
          image: TOKEN_ICONS[symbol] || rapidCoin?.iconUrl || '/default-token.png',
          price: resolvedPrice !== null ? resolvedPrice.toString() : '0',
          change: resolvedChange !== null ? resolvedChange.toString() : '0',
          marketCap: resolvedMarketCap !== null ? resolvedMarketCap.toString() : '0',
          priceSource: binancePrice !== null
            ? 'binance'
            : (coinbasePrice !== null
              ? 'coinbase'
              : (rapidPrice !== null ? 'rapidapi' : 'unknown')),
          rank: rapidCoin?.rank,
          type: rapidCoin?.type || 'cryptocurrency',
          description: rapidCoin?.description,
          isStablecoin: ['USDT', 'USDC'].includes(symbol)
        };
      });
  }, [rapidBySymbol, binanceBySymbol, globalPrices]);

  // Helper to get sortable value
  const getSortValue = (token, key) => {
    switch(key) {
      case 'symbol':
        return token.symbol?.toLowerCase() || '';
      case 'name':
        return token.name?.toLowerCase() || '';
      case 'price':
        return parseFloat(token.price) || 0;
      case 'marketCap':
        return parseFloat(token.marketCap) || 0;
      case 'change':
        return parseFloat(token.change) || 0;
      default:
        return 0;
    }
  };
  
  // Filter and sort tokens
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = tokens.filter(token => {
      const term = searchTerm.toLowerCase();
      return (
        token.symbol?.toLowerCase().includes(term) ||
        token.name?.toLowerCase().includes(term)
      );
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [tokens, searchTerm, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatPrice = (price, symbol) => {
    const num = parseFloat(price);
    if (!Number.isFinite(num)) return '$0.00';
    
    // Special handling for stablecoins
    if (['USDT', 'USDC'].includes(symbol) && Math.abs(num - 1) < 0.1) {
      return '$1.00';
    }
    
    const decimals = num < 0.02 ? 4 : 2;
    return '$' + num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatMarketCap = (cap) => {
    const num = parseFloat(cap);
    if (!Number.isFinite(num) || num === 0) return '—';
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const toggleRowExpansion = (tokenKey) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(tokenKey)) {
      newExpanded.delete(tokenKey);
    } else {
      newExpanded.add(tokenKey);
    }
    setExpandedRows(newExpanded);
  };

  // Show loading state
  if (rapidLoading) {
    return (
      <div className="token-table-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading token data from RapidAPI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="token-table-container">
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <input
          placeholder="Search by name or symbol..."
          className="searchBar"
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          📊 RapidAPI • {tokens.length} tokens • Real-time prices from {tokens[0]?.priceSource || 'multiple sources'}
        </div>
      </div>
      
      {/* Table */}
      <div className="table-wrapper">
        <table className="token-table">
          <thead>
            <tr>
              <th className="token-col" onClick={() => handleSort('name')}>
                Token {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="price-col" onClick={() => handleSort('price')}>
                Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="change-col" onClick={() => handleSort('change')}>
                24h Change {sortConfig.key === 'change' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="marketcap-col" onClick={() => handleSort('marketCap')}>
                Market Cap {sortConfig.key === 'marketCap' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="watchlist-col">Watchlist</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTokens.map((token) => {
              const tokenKey = token.uuid || token.symbol;
              const isWatchlisted = isInWatchlist(token);
              
              return (
                <React.Fragment key={tokenKey}>
                  <tr 
                    className={`token-row ${expandedRows.has(token.uuid) ? 'expanded' : ''}`}
                    onClick={() => token.uuid && toggleRowExpansion(token.uuid)}
                  >
                    <td className="token-cell">
                      <div className="token-info">
                        <img 
                          src={token.image} 
                          alt={token.name}
                          className="token-icon"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '/default-token.png';
                          }}
                        />
                        <div className="token-details">
                          <div className="token-name">
                            {token.name || 'Unknown'}
                            {token.isStablecoin && (
                              <span className="stablecoin-badge" style={{
                                marginLeft: '8px',
                                fontSize: '10px',
                                padding: '2px 6px',
                                background: 'var(--surface-2)',
                                borderRadius: '4px',
                                color: 'var(--text-muted)'
                              }}>Stablecoin</span>
                            )}
                          </div>
                          <div className="token-symbol">{token.symbol || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="price-cell">
                      {token.price && token.price !== '0' ? (
                        <div className="price-value">
                          {formatPrice(token.price, token.symbol)}
                          <span style={{
                            fontSize: '10px',
                            marginLeft: '6px',
                            color: 'var(--text-muted)',
                            opacity: 0.7
                          }}>
                            {token.priceSource === 'binance' ? '📊' : 
                             token.priceSource === 'coinbase' ? '📈' : 
                             token.priceSource === 'rapidapi' ? '🔄' : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="no-data">—</div>
                      )}
                    </td>
                    <td className="change-cell">
                      {token.change && token.change !== '0' ? (
                        <div className={`change-badge ${parseFloat(token.change) >= 0 ? 'positive' : 'negative'}`}>
                          {parseFloat(token.change) >= 0 ? '+' : ''}{parseFloat(token.change).toFixed(2)}%
                        </div>
                      ) : (
                        <div className="no-data">—</div>
                      )}
                    </td>
                    <td className="marketcap-cell">
                      {token.marketCap && token.marketCap !== '0' ? (
                        <div className="marketcap-value">{formatMarketCap(token.marketCap)}</div>
                      ) : (
                        <div className="no-data">—</div>
                      )}
                    </td>
                    <td className="watchlist-cell">
                      <button
                        className={`watchlist-btn ${isWatchlisted ? 'added' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatchlistToken(token);
                        }}
                        type="button"
                        aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        {isWatchlisted ? <CheckOutlined /> : <PlusCircleOutlined />}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Details */}
                  {token.uuid && expandedRows.has(token.uuid) && (
                    <tr className="details-row">
                      <td colSpan="5">
                        <div className="token-details-expanded">
                          <div className="details-grid">
                            <div className="detail-item">
                              <label>Symbol</label>
                              <div className="value">{token.symbol || '—'}</div>
                            </div>
                            <div className="detail-item">
                              <label>Type</label>
                              <div className="value">{token.type || 'Cryptocurrency'}</div>
                            </div>
                            {token.rank && (
                              <div className="detail-item">
                                <label>Rank</label>
                                <div className="value">#{token.rank}</div>
                              </div>
                            )}
                            <div className="detail-item">
                              <label>Price Source</label>
                              <div className="value" style={{ textTransform: 'capitalize' }}>
                                {token.priceSource}
                              </div>
                            </div>
                          </div>
                          
                          {/* Description if available */}
                          {token.description && (
                            <div className="description-section" style={{ marginBottom: '20px' }}>
                              <h4 style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>About</h4>
                              <p style={{ color: 'var(--text)', lineHeight: '1.6' }}>{token.description}</p>
                            </div>
                          )}
                          
                          {/* Actions */}
                          <div className="actions-section">
                            {token.uuid && (
                              <button 
                                className="action-btn primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/coins/${token.uuid}`);
                                }}
                              >
                                View Coin Details
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        
        {filteredAndSortedTokens.length === 0 && searchTerm && (
          <div className="no-results">
            <p>No tokens found matching "{searchTerm}"</p>
            <button onClick={() => setSearchTerm('')}>Clear search</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CoinsTable;