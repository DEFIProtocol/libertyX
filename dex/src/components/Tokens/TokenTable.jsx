import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTokens } from '../../contexts/TokenContext';
import { useRapidApi } from '../../contexts/RapidApiContext';
import { useChainContext } from '../../contexts/ChainContext';
import { useBinanceWs } from '../../contexts/BinanceWsContext';
import { useGlobalPrices } from '../../contexts/GlobalPriceContext';
import './token-table.css';

function TokenTable({ tokens: tokensProp = [] }) {
  const navigate = useNavigate();
  const { dbTokens } = useTokens();
  const { coins } = useRapidApi();
  const { latestData } = useBinanceWs();
  const { prices: globalPrices } = useGlobalPrices();
  const { selectedChain } = useChainContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [expandedRows, setExpandedRows] = useState(new Set());

  const rapidBySymbol = useMemo(() => {
    const map = {};
    (coins || []).forEach((coin) => {
      if (coin?.symbol) {
        map[coin.symbol.toUpperCase()] = coin;
      }
    });
    return map;
  }, [coins]);

  const baseTokens = useMemo(() => {
    if (Array.isArray(dbTokens) && dbTokens.length) return dbTokens;
    return tokensProp;
  }, [dbTokens, tokensProp]);

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

  const tokens = useMemo(() => {
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

    return (baseTokens || [])
      .map((token) => {
        if (!token?.uuid) return null;
        const chains = normalizeChains(token?.chains);
        const chainKey = String(selectedChain || '');
        const aliasKeys = chainKeyMap[chainKey] || [];
        const chainMatch = chains?.[chainKey] || aliasKeys.some((key) => chains?.[key]);
        if (!chainMatch) return null;
        const symbolKey = token.symbol?.toUpperCase();
        const rapidCoin = symbolKey ? rapidBySymbol[symbolKey] : null;
        const binanceTicker = symbolKey ? binanceBySymbol[symbolKey] : null;
        const binancePrice = binanceTicker?.c ? parseFloat(binanceTicker.c) : null;
        const priceEntry = symbolKey ? globalPrices?.[symbolKey] : null;
        const coinbasePrice = priceEntry?.coinbasePrice ?? null;
        const rapidPrice = priceEntry?.rapidPrice ?? (rapidCoin?.price ? parseFloat(rapidCoin.price) : null);
        const resolvedPrice = binancePrice ?? coinbasePrice ?? rapidPrice ?? null;

        const resolvedMarketCap =
          priceEntry?.marketCap ??
          priceEntry?.coinData?.marketCap ??
          (rapidCoin?.marketCap ?? null);
        const resolvedChange =
          priceEntry?.change ??
          priceEntry?.coinData?.change ??
          (rapidCoin?.change ?? null);

        return {
          ...token,
          uuid: token.uuid || rapidCoin?.uuid,
          name: token.name || rapidCoin?.name || token.symbol,
          price: resolvedPrice !== null ? resolvedPrice.toString() : '0',
          change:
            token.change || (resolvedChange !== null && resolvedChange !== undefined
              ? resolvedChange.toString()
              : '0'),
          marketCap:
            token.marketCap || token.market_cap || (resolvedMarketCap ?? '0'),
          priceSource: binancePrice !== null
            ? 'binance'
            : (coinbasePrice !== null
              ? 'coinbase'
              : (rapidPrice !== null ? 'rapidapi' : 'unknown'))
        };
      })
      .filter(Boolean);
  }, [baseTokens, rapidBySymbol, binanceBySymbol, selectedChain, globalPrices]);
  
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

  const formatPrice = (price) => {
    const num = parseFloat(price);
    if (!Number.isFinite(num)) return '0.00';
    const decimals = num < 0.02 ? 4 : 2;
    return num.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const formatMarketCap = (cap) => {
    const num = parseFloat(cap);
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
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
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedTokens.map((token) => {
              const tokenKey = token.uuid || token.symbol || Math.random();
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
                          <div className="token-name">{token.name || 'Unknown'}</div>
                          <div className="token-symbol">{token.symbol || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="price-cell">
                      {token.price && token.price !== '0' ? (
                        <div className="price-value">{formatPrice(token.price)}</div>
                      ) : (
                        <div className="no-data">—</div>
                      )}
                    </td>
                    <td className="change-cell">
                      {token.change ? (
                        <div className={`change-badge ${parseFloat(token.change) >= 0 ? 'positive' : 'negative'}`}>
                          {parseFloat(token.change).toFixed(2)}%
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
                  </tr>
                  
                  {/* Expanded Details */}
                  {token.uuid && expandedRows.has(token.uuid) && (
                    <tr className="details-row">
                      <td colSpan="4">
                        <div className="token-details-expanded">
                          <div className="details-grid">
                            <div className="detail-item">
                              <label>Symbol</label>
                              <div className="value">{token.symbol || '—'}</div>
                            </div>
                            <div className="detail-item">
                              <label>Type</label>
                              <div className="value">{token.type || 'Unknown'}</div>
                            </div>
                          </div>
                          
                          {/* Addresses */}
                          {token.addresses && Object.keys(token.addresses).length > 0 && (
                            <div className="addresses-section">
                              <h4>Network Addresses</h4>
                              <div className="addresses-grid">
                                {Object.entries(token.addresses).map(([network, address]) => (
                                  <div key={network} className="address-item">
                                    <span className="network-label">{network}</span>
                                    <span className="address-value" title={address}>
                                      {address.substring(0, 6)}...{address.substring(address.length - 4)}
                                    </span>
                                    <button 
                                      className="copy-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(address);
                                      }}
                                      title="Copy address"
                                    >
                                      📋
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Actions */}
                          <div className="actions-section">
                            {token.uuid && (
                              <button 
                                className="action-btn primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/token/${token.uuid}`);
                                }}
                              >
                                View Token Details
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

export default TokenTable;