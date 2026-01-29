// AdminTokenManager.jsx - Optimized version
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTokens } from '../../contexts/TokenContext';
import { useGetCryptosQuery, useTokenCrud } from '../../hooks';
import '../Tokens/token-table.css';
import './AdminTokenManager.css';

// Simple debounce hook replacement
function useSimpleDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    const timeoutRef = useRef(null);

    useEffect(() => {
        timeoutRef.current = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timeoutRef.current);
    }, [value, delay]);

    return debouncedValue;
}

// AdminTokenManager - Main Component
const AdminTokenManager = React.memo(function AdminTokenManager({ tokens = [], isLoading = false }) {
    const { 
        comparisonMode, 
        toggleComparisonMode,
        loadingAll,
        loadingDb,
        loadingJson,
        errorDb,
        errorJson,
        comparisonStats,
        dbCount,
        jsonCount,
        dbTokens
    } = useTokens();
    
    // Get market data
    const { data: marketData } = useGetCryptosQuery(1200);
    console.log('Market Data:', marketData?.data?.coins);
    
    // Extract market symbols
    const marketSymbols = useMemo(() => {
        if (!marketData?.data?.coins) return new Set();
        return new Set(marketData.data.coins.map(coin => coin.symbol?.toUpperCase()));
    }, [marketData]);
    
    // State
    const [selectedTokens, setSelectedTokens] = useState([]);
    const [viewMode, setViewMode] = useState('all');
    const [editingToken, setEditingToken] = useState(null);
    const [addingToken, setAddingToken] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useSimpleDebounce(searchTerm, 300);
    const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'asc' });
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [editingStatus, setEditingStatus] = useState(null);
    const [addingStatus, setAddingStatus] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');

    // Get sortable value for table
    const getSortValue = (token, key) => {
        switch(key) {
            case 'symbol':
                return token.symbol?.toLowerCase() || '';
            case 'name':
                return token.name?.toLowerCase() || '';
            case 'price':
                return parseFloat(token.price) || 0;
            case 'market_cap':
            case 'marketCap':
                return parseFloat(token.marketCap || token.market_cap) || 0;
            case 'volume_24h':
                return parseFloat(token.volume_24h) || 0;
            default:
                return 0;
        }
    };

    // Optimized filter and sort
    const filteredAndSortedTokens = useMemo(() => {
        if (!tokens.length) return [];
        if (!debouncedSearchTerm && !marketSymbols.size) return tokens.slice(0, 100); // Limit initial load
        
        let filtered;
        
        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            filtered = [];
            for (let i = 0; i < Math.min(tokens.length, 1000); i++) {
                const token = tokens[i];
                if (!token.uuid || !marketSymbols.has(token.symbol?.toUpperCase())) continue;
                
                if (token.symbol?.toLowerCase().includes(term) || 
                    token.name?.toLowerCase().includes(term)) {
                    filtered.push(token);
                }
            }
        } else {
            filtered = tokens.slice(0, 200).filter(token => 
                token.uuid && marketSymbols.has(token.symbol?.toUpperCase())
            );
        }
        
        // Sort if needed
        if (filtered.length > 1 && sortConfig.key) {
            const dir = sortConfig.direction === 'asc' ? 1 : -1;
            filtered.sort((a, b) => {
                const aVal = getSortValue(a, sortConfig.key);
                const bVal = getSortValue(b, sortConfig.key);
                return (aVal - bVal) * dir;
            });
        }
        
        return filtered;
    }, [tokens, debouncedSearchTerm, sortConfig, marketSymbols, getSortValue]);

    const dbTokenBySymbol = useMemo(() => {
        const map = new Map();
        if (Array.isArray(dbTokens)) {
            dbTokens.forEach((token) => {
                if (token?.symbol) {
                    map.set(token.symbol.toLowerCase(), token);
                }
            });
        }
        return map;
    }, [dbTokens]);

    // Event handlers with useCallback
    const toggleRowExpansion = useCallback((tokenKey) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(tokenKey)) {
                newSet.delete(tokenKey);
            } else {
                newSet.add(tokenKey);
            }
            return newSet;
        });
    }, []);

    const handleSort = useCallback((key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    const toggleTokenSelection = useCallback((token) => {
        setSelectedTokens(prev => {
            const key = token.symbol || token.id;
            const exists = prev.some(t => (t.symbol || t.id) === key);
            if (exists) {
                return prev.filter(t => (t.symbol || t.id) !== key);
            }
            return [...prev, token];
        });
    }, []);

    const formatPrice = useCallback((price) => {
        if (!price) return '—';
        return parseFloat(price).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }, []);

    const formatMarketCap = useCallback((cap) => {
        if (!cap) return '—';
        const num = parseFloat(cap);
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        return `$${num.toFixed(2)}`;
    }, []);

    const handleEditClose = useCallback(() => {
        setEditingToken(null);
        setEditingStatus(null);
    }, []);

    const handleAddClose = useCallback(() => {
        setAddingToken(false);
        setAddingStatus(null);
    }, []);

    if (loadingAll) {
        return <div className="loading">Loading token data...</div>;
    }

    return (
        <div className="admin-token-manager">
            {comparisonMode ? (
                <ComparisonView 
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    tokens={tokens}
                    selectedTokens={selectedTokens}
                    onSelectToken={toggleTokenSelection}
                    toggleComparisonMode={toggleComparisonMode}
                    setAddingToken={setAddingToken}
                    comparisonStats={comparisonStats}
                    errorDb={errorDb}
                    errorJson={errorJson}
                    loadingDb={loadingDb}
                    loadingJson={loadingJson}
                    dbCount={dbCount}
                    jsonCount={jsonCount}
                />
            ) : (
                <NormalView 
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filteredAndSortedTokens={filteredAndSortedTokens}
                    expandedRows={expandedRows}
                    onToggleExpansion={toggleRowExpansion}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    formatPrice={formatPrice}
                    formatMarketCap={formatMarketCap}
                    onEdit={setEditingToken}
                    dbTokenBySymbol={dbTokenBySymbol}
                    toggleComparisonMode={toggleComparisonMode}
                    setAddingToken={setAddingToken}
                    errorDb={errorDb}
                    errorJson={errorJson}
                    loadingDb={loadingDb}
                    loadingJson={loadingJson}
                    dbCount={dbCount}
                    jsonCount={jsonCount}
                />
            )}

            {/* Removed modals - editing now happens inline */}
        </div>
    );
});

// Normal View Component
const NormalView = React.memo(function NormalView({
    searchTerm,
    setSearchTerm,
    filteredAndSortedTokens,
    expandedRows,
    onToggleExpansion,
    sortConfig,
    onSort,
    formatPrice,
    formatMarketCap,
    onEdit,
    dbTokenBySymbol,
    toggleComparisonMode,
    setAddingToken,
    errorDb,
    errorJson,
    loadingDb,
    loadingJson,
    dbCount,
    jsonCount
}) {
    const handleSearchChange = useCallback((e) => {
        setSearchTerm(e.target.value);
    }, [setSearchTerm]);

    return (
        <>
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
                        onClick={() => setAddingToken(true)}
                        className="add-token-btn"
                    >
                        ➕ Add Token
                    </button>
                    
                    <button 
                        onClick={toggleComparisonMode} 
                        className="comparison-toggle"
                    >
                        🔍 Compare DB vs JSON
                    </button>
                </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <input
                    placeholder="Search by name or symbol..."
                    className="searchBar"
                    type="text"
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
            </div>

            <div className="table-wrapper">
                <VirtualizedAdminTokenTable
                    tokens={filteredAndSortedTokens}
                    expandedRows={expandedRows}
                    onToggleExpansion={onToggleExpansion}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    formatPrice={formatPrice}
                    formatMarketCap={formatMarketCap}
                    onEdit={onEdit}
                    dbTokenBySymbol={dbTokenBySymbol}
                />
            </div>
        </>
    );
});

// Virtualized Table Component
const VirtualizedAdminTokenTable = React.memo(function VirtualizedAdminTokenTable({ 
    tokens, 
    expandedRows,
    onToggleExpansion,
    sortConfig,
    onSort,
    formatPrice,
    formatMarketCap,
    onEdit,
    dbTokenBySymbol
}) {
    const Row = useCallback(({ index, style }) => {
        const token = tokens[index];
        if (!token) return null;
        
        const tokenId = token.uuid || token.id || token.symbol;
        const isExpanded = expandedRows.has(tokenId);
        const price = parseFloat(token.price) || 0;
        const marketCap = parseFloat(token.marketCap) || 0;
        const dbToken = token?.symbol ? dbTokenBySymbol.get(token.symbol.toLowerCase()) : null;
        const detailsToken = dbToken || token;
        
        return (
            <tr 
                key={tokenId}
                className={`token-row ${isExpanded ? 'expanded' : ''}`}
                onClick={() => tokenId && onToggleExpansion(tokenId)}
                style={style}
            >
                <td className="rank-col">
                    <span className="rank-badge">{token.symbol || '—'}</span>
                </td>
                <td className="token-cell">
                    <div className="token-info">
                        <div className="token-details">
                            <div className="token-name">{token.name || 'Unknown'}</div>
                            <div className="token-symbol">{token.symbol || '—'}</div>
                        </div>
                    </div>
                </td>
                <td className="price-cell">
                    {price ? (
                        <div className="price-value">
                            {formatPrice(price)}
                        </div>
                    ) : (
                        <div className="no-data">—</div>
                    )}
                </td>
                <td className="marketcap-cell">
                    {marketCap > 0 ? (
                        <div className="marketcap-value">{formatMarketCap(marketCap)}</div>
                    ) : (
                        <div className="no-data">—</div>
                    )}
                </td>
                <td className="change-col">
                    <button 
                        className="action-btn primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(detailsToken);
                        }}
                    >
                        ✎ Edit
                    </button>
                </td>
            </tr>
        );
    }, [tokens, expandedRows, formatPrice, formatMarketCap, onEdit, onToggleExpansion, dbTokenBySymbol]);

    return (
        <div className="virtualized-table">
            <table className="token-table admin-token-table">
                <thead>
                    <tr>
                        <th className="rank-col" onClick={() => onSort('symbol')}>
                            Symbol {sortConfig.key === 'symbol' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="token-col" onClick={() => onSort('name')}>
                            Token {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="price-col" onClick={() => onSort('price')}>
                            Price {sortConfig.key === 'price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="marketcap-col" onClick={() => onSort('market_cap')}>
                            Market Cap {sortConfig.key === 'market_cap' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="change-col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {tokens.map((token, index) => {
                        const tokenId = token.uuid || token.id || token.symbol;
                        const isExpanded = expandedRows.has(tokenId);
                        const price = parseFloat(token.price) || 0;
                        const marketCap = parseFloat(token.marketCap) || 0;
                        const dbToken = token?.symbol ? dbTokenBySymbol.get(token.symbol.toLowerCase()) : null;
                        const detailsToken = dbToken || token;
                        
                        return (
                            <React.Fragment key={tokenId}>
                                <tr 
                                    className={`token-row ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => tokenId && onToggleExpansion(tokenId)}
                                >
                                    <td className="rank-col">
                                        <span className="rank-badge">{token.symbol || '—'}</span>
                                    </td>
                                    <td className="token-cell">
                                        <div className="token-info">
                                            <div className="token-details">
                                                <div className="token-name">{token.name || 'Unknown'}</div>
                                                <div className="token-symbol">{token.symbol || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="price-cell">
                                        {price ? (
                                            <div className="price-value">
                                                {formatPrice(price)}
                                            </div>
                                        ) : (
                                            <div className="no-data">—</div>
                                        )}
                                    </td>
                                    <td className="marketcap-cell">
                                        {marketCap > 0 ? (
                                            <div className="marketcap-value">{formatMarketCap(marketCap)}</div>
                                        ) : (
                                            <div className="no-data">—</div>
                                        )}
                                    </td>
                                    <td className="change-col">
                                        <button 
                                            className="action-btn primary"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEdit(detailsToken);
                                            }}
                                        >
                                            ✎ Edit
                                        </button>
                                    </td>
                                </tr>
                                
                                {isExpanded && (
                                    <tr className="details-row">
                                        <td colSpan="5">
                                            <AdminTokenDetails token={detailsToken} onRefresh={() => {}} />
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
});

// Admin Token Details Component - Inline Editable with All Fields
const AdminTokenDetails = React.memo(function AdminTokenDetails({ token, onRefresh }) {
    const { updateToken, loading: isSaving } = useTokenCrud();
    const [isEditing, setIsEditing] = useState(false);
    
    // Initialize editData with ALL token fields
    const [editData, setEditData] = useState(() => {
        const data = { ...token };
        // Ensure we have all the data from the token
        return data;
    });
    
    const [saveStatus, setSaveStatus] = useState(null); // null, 'saving', 'success', 'error'
    const [saveError, setSaveError] = useState('');

    const [customParams, setCustomParams] = useState(token.customParams || {});
    const [newParamName, setNewParamName] = useState('');
    const [newParamValue, setNewParamValue] = useState('');
    
    const fieldOrder = useMemo(() => (
        [
            { key: 'symbol', label: 'Symbol', type: 'text', readOnly: true },
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'decimals', label: 'Decimals', type: 'number' },
            { key: 'type', label: 'Type', type: 'text' },
            { key: 'image', label: 'Image', type: 'text' },
            { key: 'uuid', label: 'UUID', type: 'text', readOnly: true }
        ]
    ), []);

    const editableFields = useMemo(() => {
        return fieldOrder.map(field => ({
            ...field,
            value: editData[field.key] ?? token[field.key] ?? ''
        }));
    }, [fieldOrder, editData, token]);
    
    const handleEditChange = useCallback((field, value) => {
        setEditData(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);
    
    const handleSave = useCallback(async () => {
        setSaveStatus('saving');
        setSaveError('');
        try {
            // Only send changed fields that are not read-only
            const changedData = {};
            const editableKeys = new Set(['name', 'decimals', 'type', 'image']);
            for (const [key, value] of Object.entries(editData)) {
                if (editableKeys.has(key) && value !== token[key]) {
                    changedData[key] = value;
                }
            }
            
            if (Object.keys(changedData).length === 0) {
                setSaveStatus('success');
                setTimeout(() => {
                    setSaveStatus(null);
                    setIsEditing(false);
                }, 1500);
                return;
            }
            
            const result = await updateToken(token.symbol, changedData);
            if (result.success) {
                setSaveStatus('success');
                setTimeout(() => {
                    setSaveStatus(null);
                    setIsEditing(false);
                    if (onRefresh) onRefresh();
                }, 1500);
            } else {
                setSaveError(result.error || 'Failed to update token');
                setSaveStatus('error');
            }
        } catch (error) {
            setSaveError(error.message || 'An error occurred');
            setSaveStatus('error');
        }
    }, [editData, token, updateToken, onRefresh]);
    
    const handleCancel = useCallback(() => {
        setEditData({ ...token });
        setSaveStatus(null);
        setSaveError('');
        setIsEditing(false);
    }, [token]);

    const addCustomParameter = useCallback(() => {
        if (newParamName.trim() && newParamValue.trim()) {
            setCustomParams(prev => ({
                ...prev,
                [newParamName]: newParamValue
            }));
            setNewParamName('');
            setNewParamValue('');
        }
    }, [newParamName, newParamValue]);

    const removeCustomParameter = useCallback((paramName) => {
        setCustomParams(prev => {
            const updated = { ...prev };
            delete updated[paramName];
            return updated;
        });
    }, []);

    const handleKeyDown = useCallback((e, callback) => {
        if (e.key === 'Enter') {
            callback();
        }
    }, []);
    
    return (
        <div className="token-details-expanded">
            <div className="details-grid">
                {/* Token fields */}
                {isEditing ? (
                    <>
                        {editableFields.map((field) => (
                            <div key={field.key} className="detail-item">
                                <label>{field.label}</label>
                                {field.readOnly ? (
                                    <div className="value">{field.value || '—'}</div>
                                ) : (
                                    <input
                                        type={field.type}
                                        value={field.value ?? ''}
                                        onChange={(e) => {
                                            const value = field.type === 'number' 
                                                ? (e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                                                : e.target.value;
                                            handleEditChange(field.key, value);
                                        }}
                                        className="edit-input"
                                        placeholder={field.label}
                                        step={field.type === 'number' ? 'any' : undefined}
                                        min={field.type === 'number' ? 0 : undefined}
                                    />
                                )}
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        {editableFields.map((field) => (
                            <div key={field.key} className="detail-item">
                                <label>{field.label}</label>
                                <div className="value">{field.value || '—'}</div>
                            </div>
                        ))}
                    </>
                )}
            </div>
            
            {/* Save Status Indicator */}
            {saveStatus && (
                <div className={`save-status save-status-${saveStatus}`}>
                    {saveStatus === 'saving' && '💾 Saving...'}
                    {saveStatus === 'success' && '✓ Saved successfully!'}
                    {saveStatus === 'error' && `✗ ${saveError}`}
                </div>
            )}

            {/* Custom Parameters */}
            <CustomParametersSection
                customParams={customParams}
                newParamName={newParamName}
                newParamValue={newParamValue}
                onParamNameChange={setNewParamName}
                onParamValueChange={setNewParamValue}
                onAddParam={addCustomParameter}
                onRemoveParam={removeCustomParameter}
                onKeyDown={handleKeyDown}
            />
            
            {/* Addresses */}
            <AddressesSection addresses={token.addresses} />
            
            <div className="actions-section">
                {isEditing ? (
                    <>
                        <button
                            className="action-btn success"
                            onClick={handleSave}
                            disabled={isSaving || saveStatus === 'saving'}
                        >
                            {isSaving || saveStatus === 'saving' ? '💾 Saving...' : 'Save Changes'}
                        </button>
                        <button
                            className="action-btn secondary"
                            onClick={handleCancel}
                            disabled={isSaving || saveStatus === 'saving'}
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <button className="action-btn primary" onClick={() => setIsEditing(true)}>
                        Edit Token
                    </button>
                )}
            </div>
        </div>
    );
});

// Custom Parameters Sub-component
const CustomParametersSection = React.memo(function CustomParametersSection({
    customParams,
    newParamName,
    newParamValue,
    onParamNameChange,
    onParamValueChange,
    onAddParam,
    onRemoveParam,
    onKeyDown
}) {
    const hasParams = Object.keys(customParams).length > 0;
    
    return (
        <div className="custom-params-section">
            <h4>Custom Parameters</h4>
            
            {hasParams && (
                <div className="params-grid">
                    {Object.entries(customParams).map(([key, value]) => (
                        <div key={key} className="param-item">
                            <div className="param-header">
                                <span className="param-name">{key}</span>
                                <button 
                                    className="remove-param-btn"
                                    onClick={() => onRemoveParam(key)}
                                    title="Remove parameter"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="param-value">{value}</div>
                        </div>
                    ))}
                </div>
            )}
            
            <div className="add-param-form">
                <input 
                    type="text"
                    placeholder="Parameter name"
                    value={newParamName}
                    onChange={(e) => onParamNameChange(e.target.value)}
                    onKeyDown={(e) => onKeyDown(e, onAddParam)}
                />
                <input 
                    type="text"
                    placeholder="Parameter value"
                    value={newParamValue}
                    onChange={(e) => onParamValueChange(e.target.value)}
                    onKeyDown={(e) => onKeyDown(e, onAddParam)}
                />
                <button 
                    className="add-param-btn"
                    onClick={onAddParam}
                >
                    + Add Parameter
                </button>
            </div>
        </div>
    );
});

// Addresses Sub-component
const AddressesSection = React.memo(function AddressesSection({ addresses }) {
    const copyToClipboard = useCallback((address) => {
        navigator.clipboard.writeText(address);
    }, []);
    
    if (!addresses || Object.keys(addresses).length === 0) return null;
    
    return (
        <div className="addresses-section">
            <h4>Network Addresses</h4>
            <div className="addresses-grid">
                {Object.entries(addresses).map(([network, address]) => (
                    <div key={network} className="address-item">
                        <span className="network-label">{network}</span>
                        <span className="address-value" title={address}>
                            {address.substring(0, 6)}...{address.substring(address.length - 4)}
                        </span>
                        <button 
                            className="copy-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(address);
                            }}
                            title="Copy address"
                        >
                            📋
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
});

// Comparison View Component
const ComparisonView = React.memo(function ComparisonView({
    viewMode,
    setViewMode,
    tokens,
    selectedTokens,
    onSelectToken,
    toggleComparisonMode,
    setAddingToken,
    comparisonStats,
    errorDb,
    errorJson,
    loadingDb,
    loadingJson,
    dbCount,
    jsonCount
}) {
    const filteredTokens = useMemo(() => {
        switch(viewMode) {
            case 'onlyDb':
                return tokens.filter(item => item.inDatabase && !item.inJson);
            case 'onlyJson':
                return tokens.filter(item => !item.inDatabase && item.inJson);
            case 'diff':
                return tokens.filter(item => item.inDatabase && item.inJson && !item.isMatch);
            case 'both':
                return tokens.filter(item => item.inDatabase && item.inJson);
            default:
                return tokens;
        }
    }, [tokens, viewMode]);
    
    return (
        <>
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
                        onClick={() => setAddingToken(true)}
                        className="add-token-btn"
                    >
                        ➕ Add Token
                    </button>
                    
                    <button 
                        onClick={toggleComparisonMode} 
                        className="comparison-toggle active"
                    >
                        🔍 Hide Comparison
                    </button>
                    
                    {comparisonStats && (
                        <div className="comparison-stats">
                            <span className="stat-item">Both: {comparisonStats.inBoth}</span>
                            <span className="stat-item">Only DB: {comparisonStats.onlyInDb}</span>
                            <span className="stat-item">Only JSON: {comparisonStats.onlyInJson}</span>
                            <span className="stat-item">Diff: {comparisonStats.different}</span>
                        </div>
                    )}
                </div>
            </div>

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

            <div className="table-container">
                <VirtualizedComparisonTable 
                    tokens={filteredTokens}
                    selectedTokens={selectedTokens}
                    onSelectToken={onSelectToken}
                    viewMode={viewMode}
                />
            </div>
        </>
    );
});

// Virtualized Comparison Table
const VirtualizedComparisonTable = React.memo(function VirtualizedComparisonTable({ 
    tokens, 
    selectedTokens, 
    onSelectToken, 
    viewMode 
}) {
    return (
        <div className="virtualized-comparison-table">
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
                            isSelected={selectedTokens.some(t => (t.symbol || t.id) === (item.symbol || item.id))}
                            onSelect={() => onSelectToken(item)}
                            viewMode={viewMode}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
});

// Comparison Row Component
const ComparisonRow = React.memo(function ComparisonRow({ item, isSelected, onSelect, viewMode }) {
    const { symbol, inDatabase, inJson, database, json, match } = item;
    
    const getRowClass = useCallback(() => {
        if (!inDatabase && inJson) return 'only-json';
        if (inDatabase && !inJson) return 'only-db';
        if (inDatabase && inJson && !match) return 'different';
        if (match) return 'matching';
        return '';
    }, [inDatabase, inJson, match]);
    
    const formatValue = useCallback((value, field) => {
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
    }, []);
    
    const rowClass = getRowClass();
    
    return (
        <tr className={`${rowClass} ${isSelected ? 'selected' : ''}`}>
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
            
            <td className="status-col">
                <div className={`status-badge ${rowClass}`}>
                    {!inDatabase && inJson && 'Only in JSON'}
                    {inDatabase && !inJson && 'Only in DB'}
                    {inDatabase && inJson && match && '✅ Match'}
                    {inDatabase && inJson && !match && '❌ Different'}
                </div>
            </td>
            
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
});

export default AdminTokenManager;