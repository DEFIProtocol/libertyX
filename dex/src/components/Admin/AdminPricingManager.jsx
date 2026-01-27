// src/components/Admin/AdminPricingManager.jsx
import { useState } from 'react';
import { useTokens } from '../../contexts/TokenContext';
import { useLivePrices } from '../../hooks/useLivePrice';
import './AdminPricingManager.css';

function AdminPricingManager() {
    const { 
        dbTokens,
        comparisonMode,
        toggleComparisonMode,
        loadingAll,
        dbCount,
        jsonCount
    } = useTokens();
    
    // Get top 10 tokens to avoid API limits
    const topTokens = dbTokens.slice(0, 10).map(token => token.symbol);
    
    // Get live prices for top tokens
    const { 
        prices, 
        isLoading: pricesLoading, 
        error: pricesError,
        streamingCount,
        found
    } = useLivePrices(topTokens, {
        enabled: true
    });
    
    const [viewMode, setViewMode] = useState('all'); // 'all', 'mismatch', 'noPrice'
    const [selectedTokens, setSelectedTokens] = useState([]);
    const [showPriceDetails, setShowPriceDetails] = useState(false);

    // Filter tokens based on view mode
    const getFilteredTokens = () => {
        return dbTokens.slice(0, 10).map(token => {
            const priceData = prices[token.symbol];
            return {
                ...token,
                currentPrice: priceData?.price,
                priceSource: priceData?.source,
                isStreaming: priceData?.timestamp > Date.now() - 10000 // Recent update
            };
        }).filter(token => {
            switch(viewMode) {
                case 'mismatch':
                    // Show tokens where database price differs from current price
                    return token.price && token.currentPrice && 
                           Math.abs(token.price - token.currentPrice) > (token.price * 0.01); // 1% difference
                case 'noPrice':
                    // Show tokens without current price
                    return !token.currentPrice;
                default:
                    return true;
            }
        });
    };

    // Toggle token selection
    const toggleTokenSelection = (symbol) => {
        setSelectedTokens(prev => {
            if (prev.includes(symbol)) {
                return prev.filter(s => s !== symbol);
            } else {
                return [...prev, symbol];
            }
        });
    };

    // Update database price for selected tokens
    const updateDatabasePrices = async () => {
        if (selectedTokens.length === 0) {
            alert('Please select tokens to update');
            return;
        }
        
        try {
            const updates = selectedTokens.map(symbol => {
                const token = dbTokens.find(t => t.symbol === symbol);
                const priceData = prices[symbol];
                return {
                    symbol,
                    newPrice: priceData?.price,
                    oldPrice: token?.price
                };
            }).filter(update => update.newPrice);
            
            // Here you would call your API to update prices
            // For now, just log
            console.log('Would update prices:', updates);
            alert(`Would update ${updates.length} token prices in database`);
            
        } catch (error) {
            console.error('Error updating prices:', error);
            alert('Failed to update prices');
        }
    };

    if (loadingAll || pricesLoading) {
        return <div className="loading">Loading pricing data...</div>;
    }

    return (
        <div className="admin-pricing-manager">
            {/* Header */}
            <div className="manager-header">
                <div className="header-left">
                    <h2>Pricing Management</h2>
                    <div className="stats-row">
                        <div className="stat-item">
                            <span className="stat-label">Database Tokens:</span>
                            <span className="stat-value">{dbCount}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Live Prices:</span>
                            <span className={`stat-value ${streamingCount > 0 ? 'streaming' : ''}`}>
                                {streamingCount}/{topTokens.length} streaming
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Prices Found:</span>
                            <span className="stat-value">{found}/{topTokens.length}</span>
                        </div>
                    </div>
                </div>
                
                <div className="header-right">
                    <button 
                        onClick={toggleComparisonMode} 
                        className={`comparison-toggle ${comparisonMode ? 'active' : ''}`}
                    >
                        {comparisonMode ? '🔍 Hide DB/JSON' : '🔍 Compare DB/JSON'}
                    </button>
                    
                    <button 
                        onClick={() => setShowPriceDetails(!showPriceDetails)}
                        className={`details-toggle ${showPriceDetails ? 'active' : ''}`}
                    >
                        {showPriceDetails ? '📊 Hide Details' : '📊 Show Details'}
                    </button>
                </div>
            </div>

            {/* Controls */}
            <div className="controls-row">
                <div className="view-controls">
                    <select 
                        value={viewMode} 
                        onChange={(e) => setViewMode(e.target.value)}
                        className="view-select"
                    >
                        <option value="all">All Tokens</option>
                        <option value="mismatch">Price Mismatch ({'>'}1%)</option>
                        <option value="noPrice">No Current Price</option>
                    </select>
                    
                    <div className="selection-info">
                        {selectedTokens.length} token(s) selected
                        {selectedTokens.length > 0 && (
                            <button 
                                onClick={updateDatabasePrices}
                                className="update-btn"
                            >
                                Update Selected in DB
                            </button>
                        )}
                    </div>
                </div>
                
                {pricesError && (
                    <div className="error-alert">
                        ❌ Pricing Error: {pricesError.message}
                    </div>
                )}
            </div>

            {/* Main Table */}
            <div className="table-container">
                <PricingTable 
                    tokens={getFilteredTokens()}
                    prices={prices}
                    selectedTokens={selectedTokens}
                    onSelectToken={toggleTokenSelection}
                    showDetails={showPriceDetails}
                />
            </div>

            {/* Price Stats */}
            {showPriceDetails && (
                <div className="price-stats">
                    <h3>Price Statistics</h3>
                    <div className="stats-grid">
                        {Object.entries(prices).map(([symbol, data]) => (
                            <div key={symbol} className="price-stat-card">
                                <div className="stat-symbol">{symbol}</div>
                                <div className="stat-price">${data.price?.toFixed(2)}</div>
                                <div className={`stat-source ${data.source}`}>{data.source}</div>
                                <div className="stat-time">
                                    {new Date(data.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Pricing Table Component
function PricingTable({ tokens, prices, selectedTokens, onSelectToken, showDetails }) {
    return (
        <table className="pricing-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Database Price</th>
                    <th>Current Price</th>
                    <th>Source</th>
                    <th>Difference</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {tokens.map(token => {
                    const priceData = prices[token.symbol];
                    const dbPrice = token.price;
                    const currentPrice = priceData?.price;
                    const difference = dbPrice && currentPrice ? 
                        ((currentPrice - dbPrice) / dbPrice * 100).toFixed(2) : null;
                    
                    return (
                        <PricingRow 
                            key={token.symbol}
                            token={token}
                            dbPrice={dbPrice}
                            currentPrice={currentPrice}
                            priceData={priceData}
                            difference={difference}
                            isSelected={selectedTokens.includes(token.symbol)}
                            onSelect={() => onSelectToken(token.symbol)}
                            showDetails={showDetails}
                        />
                    );
                })}
            </tbody>
        </table>
    );
}

// Pricing Row Component
function PricingRow({ token, dbPrice, currentPrice, priceData, difference, isSelected, onSelect, showDetails }) {
    const getRowClass = () => {
        if (!currentPrice) return 'no-price';
        if (difference && Math.abs(difference) > 1) return 'mismatch';
        if (priceData?.timestamp > Date.now() - 10000) return 'streaming';
        return '';
    };

    const getStatusBadge = () => {
        if (!currentPrice) return { text: 'No Price', class: 'error' };
        if (priceData?.timestamp > Date.now() - 10000) return { text: '● LIVE', class: 'live' };
        return { text: 'Cached', class: 'cached' };
    };

    const status = getStatusBadge();

    return (
        <tr className={`${getRowClass()} ${isSelected ? 'selected' : ''}`}>
            <td>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onSelect}
                    disabled={!currentPrice}
                />
            </td>
            <td className="symbol-cell">
                <strong>{token.symbol}</strong>
            </td>
            <td>{token.name}</td>
            
            {/* Database Price */}
            <td className="db-price-cell">
                {dbPrice ? `$${dbPrice.toFixed(2)}` : '—'}
                {dbPrice && token.updated_at && (
                    <div className="price-meta">
                        Updated: {new Date(token.updated_at).toLocaleDateString()}
                    </div>
                )}
            </td>
            
            {/* Current Price */}
            <td className="current-price-cell">
                {currentPrice ? (
                    <div>
                        <div className="price-value">${currentPrice.toFixed(2)}</div>
                        {showDetails && priceData && (
                            <div className="price-meta">
                                {new Date(priceData.timestamp).toLocaleTimeString()}
                            </div>
                        )}
                    </div>
                ) : (
                    <span className="no-price-text">—</span>
                )}
            </td>
            
            {/* Source */}
            <td className="source-cell">
                {priceData?.source ? (
                    <span className={`source-badge ${priceData.source}`}>
                        {priceData.source}
                    </span>
                ) : (
                    <span className="source-badge unknown">Unknown</span>
                )}
            </td>
            
            {/* Difference */}
            <td className="difference-cell">
                {difference ? (
                    <span className={`difference ${parseFloat(difference) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(difference) >= 0 ? '▲' : '▼'} {Math.abs(difference)}%
                    </span>
                ) : '—'}
            </td>
            
            {/* Status */}
            <td className="status-cell">
                <span className={`status-badge ${status.class}`}>
                    {status.text}
                </span>
            </td>
        </tr>
    );
}

export default AdminPricingManager;