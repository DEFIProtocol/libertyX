import React, { useState, useMemo } from 'react';
import './token-table.css';

function TokenTable({ tokens, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'rank', direction: 'asc' });
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Helper to get sortable value - MOVE THIS ABOVE useMemo
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
      case 'rank':
        return token.rank || 9999;
      default:
        return 0;
    }
  };
  
  // Filter and sort tokens
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = tokens || [];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(token => 
        (token.symbol && token.symbol.toLowerCase().includes(term)) ||
        (token.name && token.name.toLowerCase().includes(term))
      );
    }
    
    // Apply sorting
    return [...filtered].sort((a, b) => {
      const aValue = getSortValue(a, sortConfig.key);
      const bValue = getSortValue(b, sortConfig.key);
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [tokens, searchTerm, sortConfig]);
  
  // Handle sort click
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  // Toggle row expansion
  const toggleRowExpansion = (uuid) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(uuid)) {
      newExpanded.delete(uuid);
    } else {
      newExpanded.add(uuid);
    }
    setExpandedRows(newExpanded);
  };
  
  // Format number helper
  const formatPrice = (price) => {
    if (!price || price === '0') return '$0.00';
    const num = parseFloat(price);
    if (isNaN(num)) return '$0.00';
    
    if (num >= 1000) {
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (num >= 1) {
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
  };
  
  // Format market cap
  const formatMarketCap = (cap) => {
    if (!cap || cap === '0') return '$0';
    const num = parseFloat(cap);
    if (isNaN(num)) return '$0';
    
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading token data...</p>
      </div>
    );
  }
  
  if (!tokens || tokens.length === 0) {
    return (
      <div className="no-tokens">
        <p>No tokens found. Try refreshing or check your connection.</p>
      </div>
    );
  }
  
  return (
    <div className="token-table-container">
      {/* Search Bar */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search tokens by symbol or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="search-stats">
          Showing {filteredAndSortedTokens.length} of {tokens.length} tokens
        </div>
      </div>
      
      {/* Table */}
      <div className="table-wrapper">
        <table className="token-table">
          <thead>
            <tr>
              <th className="rank-col" onClick={() => handleSort('rank')}>
                # {sortConfig.key === 'rank' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
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
                    <td className="rank-cell">
                      <span className="rank-badge">{token.rank || '—'}</span>
                    </td>
                    <td className="token-cell">
                      <div className="token-info">
                        <img 
                          src={token.image || token.iconUrl} 
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
                      <td colSpan="5">
                        <div className="token-details-expanded">
                          <div className="details-grid">
                            <div className="detail-item">
                              <label>UUID</label>
                              <div className="value uuid-value">{token.uuid}</div>
                            </div>
                            <div className="detail-item">
                              <label>Symbol</label>
                              <div className="value">{token.symbol || '—'}</div>
                            </div>
                            <div className="detail-item">
                              <label>Type</label>
                              <div className="value">{token.type || 'Unknown'}</div>
                            </div>
                            <div className="detail-item">
                              <label>Decimals</label>
                              <div className="value">{token.decimals || '—'}</div>
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
                                  window.open(`https://coinranking.com/coin/${token.uuid}`, '_blank');
                                }}
                              >
                                View on CoinRanking
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