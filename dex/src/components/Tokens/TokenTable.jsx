import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetCryptosQuery } from '../../hooks';
import './token-table.css';

function TokenTable({ tokens = [] }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Get market data to validate tokens exist
  const { data: marketData } = useGetCryptosQuery(1200);
  
  // Extract market coins symbols for validation
  const marketSymbols = useMemo(() => {
    const coins = marketData?.data?.coins || [];
    return new Set(coins.map(coin => coin.symbol?.toUpperCase()));
  }, [marketData]);
  
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
      // Check if token symbol exists in market data
      if (!marketSymbols.has(token.symbol?.toUpperCase())) {
        return false;
      }
      
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
  }, [tokens, searchTerm, sortConfig, marketSymbols]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const formatPrice = (price) => {
    return parseFloat(price).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
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

  const handleTokenClick = (uuid) => {
    navigate(`/token/${uuid}`);
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
                      <td colSpan="5">
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