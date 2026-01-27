// AdminTokenManager.jsx - UPDATED for comparison
import { useState } from 'react';
import { useTokens } from '../../contexts/TokenContext';
import './AdminTokenManager.css';

function AdminTokenManager() {
    const { 
        displayTokens, 
        comparisonMode, 
        toggleComparisonMode,
        loadingAll,
        loadingDb,
        loadingJson,
        errorDb,
        errorJson,
        comparisonStats,
        dbCount,
        jsonCount
    } = useTokens();
    
    const [selectedTokens, setSelectedTokens] = useState([]);
    const [viewMode, setViewMode] = useState('all'); // 'all', 'duplicates', 'diff', 'onlyDb', 'onlyJson'
    const [editingToken, setEditingToken] = useState(null);

    // Filter tokens based on view mode (for comparison)
    const getFilteredTokens = () => {
        if (!comparisonMode) return displayTokens;
        
        switch(viewMode) {
            case 'onlyDb':
                return displayTokens.filter(item => item.inDatabase && !item.inJson);
            case 'onlyJson':
                return displayTokens.filter(item => !item.inDatabase && item.inJson);
            case 'diff':
                return displayTokens.filter(item => item.inDatabase && item.inJson && !item.match);
            case 'both':
                return displayTokens.filter(item => item.inDatabase && item.inJson);
            default:
                return displayTokens;
        }
    };

    // Toggle token selection
    const toggleTokenSelection = (token) => {
        setSelectedTokens(prev => {
            const exists = prev.some(t => t.symbol === token.symbol);
            if (exists) {
                return prev.filter(t => t.symbol !== token.symbol);
            } else {
                return [...prev, token];
            }
        });
    };

    if (loadingAll) {
        return <div className="loading">Loading token data...</div>;
    }

    return (
        <div className="admin-token-manager">
            {/* Header with comparison controls */}
            <div className="manager-header">
                <div className="header-left">
                    <h2>Token Management</h2>
                    <div className="data-source-info">
                        <span className={`db-count ${errorDb ? 'error' : ''}`}>
                            🛢️ DB: {loadingDb ? '...' : errorDb ? '❌' : dbCount}
                        </span>
                        <span className={`json-count ${errorJson ? 'error' : ''}`}>
                            📄 JSON: {loadingJson ? '...' : errorJson ? '❌' : jsonCount}
                        </span>
                    </div>
                </div>
                
                <div className="header-right">
                    <button 
                        onClick={toggleComparisonMode} 
                        className={`comparison-toggle ${comparisonMode ? 'active' : ''}`}
                    >
                        {comparisonMode ? '🔍 Hide Comparison' : '🔍 Compare DB vs JSON'}
                    </button>
                    
                    {comparisonMode && (
                        <div className="comparison-stats">
                            <span className="stat-item">Both: {comparisonStats.inBoth}</span>
                            <span className="stat-item">Only DB: {comparisonStats.onlyInDb}</span>
                            <span className="stat-item">Only JSON: {comparisonStats.onlyInJson}</span>
                            <span className="stat-item">Diff: {comparisonStats.different}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Comparison controls (only shown in comparison mode) */}
            {comparisonMode && (
                <div className="comparison-controls">
                    <div className="view-filter">
                        <span className="filter-label">Show:</span>
                        <select 
                            value={viewMode} 
                            onChange={(e) => setViewMode(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All Tokens</option>
                            <option value="both">In Both Sources</option>
                            <option value="onlyDb">Only in Database</option>
                            <option value="onlyJson">Only in JSON</option>
                            <option value="diff">Different Values</option>
                        </select>
                    </div>
                    
                    <div className="selection-info">
                        {selectedTokens.length} token(s) selected
                    </div>
                </div>
            )}

            {/* Main table - changes based on comparison mode */}
            <div className="table-container">
                {comparisonMode ? (
                    <ComparisonTable 
                        tokens={getFilteredTokens()}
                        selectedTokens={selectedTokens}
                        onSelectToken={toggleTokenSelection}
                        viewMode={viewMode}
                    />
                ) : (
                    <NormalTable 
                        tokens={displayTokens}
                        selectedTokens={selectedTokens}
                        onSelectToken={toggleTokenSelection}
                    />
                )}
            </div>
        </div>
    );
}

// Normal Table Component (when not comparing)
function NormalTable({ tokens, selectedTokens, onSelectToken }) {
    return (
        <table className="token-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Market Cap</th>
                    <th>Volume (24h)</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                {tokens.map(token => (
                    <tr key={token.id || token.symbol} 
                        className={selectedTokens.some(t => t.symbol === token.symbol) ? 'selected' : ''}>
                        <td>
                            <input
                                type="checkbox"
                                checked={selectedTokens.some(t => t.symbol === token.symbol)}
                                onChange={() => onSelectToken(token)}
                            />
                        </td>
                        <td className="symbol-cell">
                            <strong>{token.symbol}</strong>
                        </td>
                        <td>{token.name}</td>
                        <td>${token.price}</td>
                        <td>${token.market_cap?.toLocaleString()}</td>
                        <td>${token.volume_24h?.toLocaleString()}</td>
                        <td>{new Date(token.updated_at || token.created_at).toLocaleDateString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// Comparison Table Component (when comparing)
function ComparisonTable({ tokens, selectedTokens, onSelectToken, viewMode }) {
    return (
        <table className="comparison-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Symbol</th>
                    <th className="source-header">Database</th>
                    <th className="source-header">JSON File</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {tokens.map(item => (
                    <ComparisonRow 
                        key={item.symbol}
                        item={item}
                        isSelected={selectedTokens.some(t => t.symbol === item.symbol)}
                        onSelect={() => onSelectToken(item)}
                        viewMode={viewMode}
                    />
                ))}
            </tbody>
        </table>
    );
}

// Comparison Row Component
function ComparisonRow({ item, isSelected, onSelect, viewMode }) {
    const { symbol, inDatabase, inJson, database, json, match } = item;
    
    // Determine row style based on comparison
    const getRowClass = () => {
        if (!inDatabase && inJson) return 'only-json';
        if (inDatabase && !inJson) return 'only-db';
        if (inDatabase && inJson && !match) return 'different';
        if (match) return 'matching';
        return '';
    };

    // Format value for display
    const formatValue = (value, field) => {
        if (value === null || value === undefined) return '—';
        
        switch(field) {
            case 'price':
                return `$${parseFloat(value).toFixed(2)}`;
            case 'market_cap':
            case 'volume_24h':
                return value ? `$${parseFloat(value).toLocaleString()}` : '—';
            default:
                return value;
        }
    };

    return (
        <tr className={`${getRowClass()} ${isSelected ? 'selected' : ''}`}>
            <td>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onSelect}
                />
            </td>
            <td className="symbol-cell">
                <strong>{symbol}</strong>
            </td>
            
            {/* Database Column */}
            <td className="source-col db-col">
                {inDatabase ? (
                    <div className="source-data">
                        <div className="source-name">{database.name}</div>
                        <div className="source-details">
                            <span>Price: {formatValue(database.price, 'price')}</span>
                            <span>MCap: {formatValue(database.market_cap, 'market_cap')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="source-missing">Not in DB</div>
                )}
            </td>
            
            {/* JSON Column */}
            <td className="source-col json-col">
                {inJson ? (
                    <div className="source-data">
                        <div className="source-name">{json.name}</div>
                        <div className="source-details">
                            <span>Price: {formatValue(json.price, 'price')}</span>
                            <span>MCap: {formatValue(json.market_cap, 'market_cap')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="source-missing">Not in JSON</div>
                )}
            </td>
            
            {/* Status Column */}
            <td className="status-col">
                <div className={`status-badge ${getRowClass()}`}>
                    {!inDatabase && inJson && 'Only in JSON'}
                    {inDatabase && !inJson && 'Only in DB'}
                    {inDatabase && inJson && match && '✅ Match'}
                    {inDatabase && inJson && !match && '❌ Different'}
                </div>
            </td>
            
            {/* Actions Column */}
            <td className="actions-col">
                {inDatabase && (
                    <button className="edit-btn">Edit</button>
                )}
                {!inDatabase && inJson && (
                    <button className="import-btn">Import</button>
                )}
                {(inDatabase || inJson) && viewMode === 'diff' && (
                    <button className="merge-btn">Merge</button>
                )}
            </td>
        </tr>
    );
}

export default AdminTokenManager;