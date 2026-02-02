// AdminTokenManager.jsx - Optimized version
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTokens } from '../../contexts/TokenContext';
import { useRapidApi } from '../../contexts/RapidApiContext';
import { useOneInch } from '../../contexts/OneInchContext';
import { useTokenCrud } from '../../hooks';
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
        dbTokens,
        refreshAll
    } = useTokens();

    const { coins: rapidCoins } = useRapidApi();
    const { tokensList: oneInchTokens, isLoading: oneInchLoading, error: oneInchError, chainId, setChainId } = useOneInch();
    const { createToken, deleteToken, updateToken } = useTokenCrud();
    
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
    const [oneInchCompareMode, setOneInchCompareMode] = useState(false);
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [dbOneInchSearch, setDbOneInchSearch] = useState('');
    const [oneInchSearch, setOneInchSearch] = useState('');
    const [oneInchStatus, setOneInchStatus] = useState('');
    const [oneInchErrorMessage, setOneInchErrorMessage] = useState('');
    const [isAddingFromOneInch, setIsAddingFromOneInch] = useState(false);
    const [isBulkAddingFromOneInch, setIsBulkAddingFromOneInch] = useState(false);
    const [isBulkDeletingTokens, setIsBulkDeletingTokens] = useState(false);
    const [bulkDeleteStatus, setBulkDeleteStatus] = useState('');
    const [bulkDeleteError, setBulkDeleteError] = useState('');
    const [isDeletingFromDb, setIsDeletingFromDb] = useState(false);
    const [comparisonExpandedRows, setComparisonExpandedRows] = useState(new Set());
    const [autoEditRows, setAutoEditRows] = useState(new Set());
    const [oneInchChainKey, setOneInchChainKey] = useState('ethereum');

    const chainOptions = useMemo(() => (
        [
            { key: 'ethereum', label: 'Ethereum', id: '1' },
            { key: 'bnb', label: 'BNB', id: '56' },
            { key: 'polygon', label: 'Polygon (PoS)', id: '137' },
            { key: 'avalanche', label: 'Avalanche', id: '43114' },
            { key: 'arbitrum', label: 'Arbitrum', id: '42161' },
            { key: 'solana', label: 'Solana', id: '501' }
        ]
    ), []);

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
        
        let filtered;
        
        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            filtered = [];
            for (let i = 0; i < Math.min(tokens.length, 1000); i++) {
                const token = tokens[i];
                if (token.symbol?.toLowerCase().includes(term) || 
                    token.name?.toLowerCase().includes(term)) {
                    filtered.push(token);
                }
            }
        } else {
            filtered = tokens.slice(0, 200);
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
    }, [tokens, debouncedSearchTerm, sortConfig, getSortValue]);

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

    const rapidBySymbol = useMemo(() => {
        const map = {};
        (rapidCoins || []).forEach((coin) => {
            if (coin?.symbol) {
                map[coin.symbol.toUpperCase()] = coin;
            }
        });
        return map;
    }, [rapidCoins]);

    const oneInchBySymbol = useMemo(() => {
        const map = {};
        (oneInchTokens || []).forEach((token) => {
            if (token?.symbol) {
                map[token.symbol.toUpperCase()] = token;
            }
        });
        return map;
    }, [oneInchTokens]);

    const oneInchFiltered = useMemo(() => {
        const term = oneInchSearch.trim().toLowerCase();
        return (oneInchTokens || []).filter((token) => {
            if (!term) return true;
            return (
                token.symbol?.toLowerCase().includes(term) ||
                token.name?.toLowerCase().includes(term)
            );
        }).slice(0, 500);
    }, [oneInchTokens, oneInchSearch]);

    const pruneCandidateCount = useMemo(() => {
        return (dbTokens || []).filter((token) => {
            const symbol = token?.symbol?.toUpperCase();
            if (!symbol) return false;
            const rapidCoin = rapidBySymbol[symbol];
            const hasUuid = !!rapidCoin?.uuid;
            return !hasUuid;
        }).length;
    }, [dbTokens, rapidBySymbol]);

    const dbOneInchFiltered = useMemo(() => {
        const term = dbOneInchSearch.trim().toLowerCase();
        return (dbTokens || []).filter((token) => {
            if (!term) return true;
            return (
                token.symbol?.toLowerCase().includes(term) ||
                token.name?.toLowerCase().includes(term)
            );
        }).slice(0, 500);
    }, [dbTokens, dbOneInchSearch]);

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
        setAutoEditRows(prev => {
            if (!prev.has(tokenKey)) return prev;
            const next = new Set(prev);
            next.delete(tokenKey);
            return next;
        });
    }, []);

    const handleSort = useCallback((key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    const openInlineEditor = useCallback((tokenKey) => {
        if (!tokenKey) return;
        setExpandedRows(prev => {
            const next = new Set(prev);
            next.add(tokenKey);
            return next;
        });
        setAutoEditRows(prev => {
            const next = new Set(prev);
            next.add(tokenKey);
            return next;
        });
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

    const toggleComparisonExpansion = useCallback((symbol) => {
        if (!symbol) return;
        setComparisonExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(symbol)) {
                next.delete(symbol);
            } else {
                next.add(symbol);
            }
            return next;
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

    const closeOneInchCompare = useCallback(() => {
        setOneInchCompareMode(false);
        setSelectedSymbol('');
        setDbOneInchSearch('');
        setOneInchSearch('');
        setOneInchStatus('');
        setOneInchErrorMessage('');
    }, []);

    const handleSelectSymbol = useCallback((symbol) => {
        if (!symbol) return;
        setSelectedSymbol(symbol.toUpperCase());
    }, []);

    const handleChainChange = useCallback((e) => {
        const nextKey = e.target.value;
        const next = chainOptions.find((c) => c.key === nextKey);
        if (!next) return;
        setOneInchChainKey(nextKey);
        setChainId(next.id);
    }, [chainOptions, setChainId]);

    const handleAddFromOneInch = useCallback(async (symbolInput) => {
        const normalized = symbolInput?.toUpperCase().trim();
        if (!normalized) return;

        setOneInchErrorMessage('');
        setOneInchStatus('');

        const oneInchToken = oneInchBySymbol[normalized];
        if (!oneInchToken) {
            setOneInchErrorMessage(`Symbol not found in 1inch: ${normalized}`);
            return;
        }

        const rapidCoin = rapidBySymbol[normalized];
        if (!rapidCoin?.uuid) {
            setOneInchErrorMessage(`Token not found in RapidAPI. ${normalized} is missing UUID.`);
            return;
        }

        try {
            setIsAddingFromOneInch(true);
            const address = oneInchToken?.address;
            const existingDbToken = dbTokenBySymbol.get(normalized.toLowerCase());

            const result = existingDbToken
                ? await updateToken(normalized, {
                    chains: {
                        ...(existingDbToken.chains || {}),
                        ...(address ? { [oneInchChainKey]: address } : {})
                    }
                })
                : await createToken({
                    symbol: normalized,
                    name: oneInchToken.name || rapidCoin?.name || normalized,
                    price: rapidCoin?.price || 0,
                    market_cap: rapidCoin?.marketCap || 0,
                    volume_24h: rapidCoin?.volume24h || 0,
                    decimals: oneInchToken.decimals,
                    type: oneInchToken.type || '1inch',
                    image: rapidCoin?.iconUrl,
                    uuid: rapidCoin?.uuid,
                    rapidapi_data: rapidCoin,
                    oneinch_data: oneInchToken,
                    chains: address ? { [oneInchChainKey]: address } : undefined
                });

            if (result.success) {
                setOneInchStatus(existingDbToken
                    ? `Updated ${normalized} with 1inch address.`
                    : `Added ${normalized} to database.`);
                refreshAll();
            } else {
                setOneInchErrorMessage(result.error || 'Failed to add token');
            }
        } catch (error) {
            setOneInchErrorMessage(error.message || 'Failed to add token');
        } finally {
            setIsAddingFromOneInch(false);
        }
    }, [createToken, updateToken, oneInchBySymbol, rapidBySymbol, refreshAll, dbTokenBySymbol, oneInchChainKey, chainId]);

    const handleAddAllFromOneInch = useCallback(async (tokensToAdd) => {
        const list = Array.isArray(tokensToAdd) ? tokensToAdd : [];
        if (!list.length) {
            setOneInchStatus('No 1inch tokens to add.');
            return;
        }

        setOneInchErrorMessage('');
        setOneInchStatus('');

        let added = 0;
        let updated = 0;
        let skippedNoUuid = 0;
        let skippedNoAddress = 0;
        let failed = 0;

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

        try {
            setIsBulkAddingFromOneInch(true);

            for (const token of list) {
                const symbol = token?.symbol?.toUpperCase();
                if (!symbol) continue;

                const rapidCoin = rapidBySymbol[symbol];
                if (!rapidCoin?.uuid) {
                    skippedNoUuid += 1;
                    continue;
                }

                const address = token?.address;
                if (!address) {
                    skippedNoAddress += 1;
                    continue;
                }

                const existingDbToken = dbTokenBySymbol.get(symbol.toLowerCase());
                const existingChains = normalizeChains(existingDbToken?.chains);

                const payload = {
                    symbol,
                    name: token?.name || rapidCoin?.name || symbol,
                    price: rapidCoin?.price || 0,
                    market_cap: rapidCoin?.marketCap || 0,
                    volume_24h: rapidCoin?.volume24h || 0,
                    decimals: token?.decimals,
                    type: token?.type || '1inch',
                    image: rapidCoin?.iconUrl,
                    uuid: rapidCoin?.uuid,
                    rapidapi_data: rapidCoin,
                    oneinch_data: token,
                    chains: {
                        ...(existingChains || {}),
                        [oneInchChainKey]: address
                    }
                };

                const result = existingDbToken
                    ? await updateToken(symbol, payload)
                    : await createToken(payload);

                if (result.success) {
                    if (existingDbToken) {
                        updated += 1;
                    } else {
                        added += 1;
                    }
                } else {
                    failed += 1;
                }
            }

            if (added || updated || skippedNoUuid || skippedNoAddress || failed) {
                setOneInchStatus(
                    `Bulk add complete. Added ${added}, updated ${updated}, skipped (no UUID) ${skippedNoUuid}, skipped (no address) ${skippedNoAddress}, failed ${failed}.`
                );
                refreshAll();
            } else {
                setOneInchStatus('No eligible tokens to add.');
            }
        } catch (error) {
            setOneInchErrorMessage(error.message || 'Bulk add failed');
        } finally {
            setIsBulkAddingFromOneInch(false);
        }
    }, [createToken, updateToken, rapidBySymbol, refreshAll, dbTokenBySymbol, oneInchChainKey]);

    const handleDeleteFromDb = useCallback(async (symbol) => {
        const normalized = symbol?.toUpperCase().trim();
        if (!normalized) return;

        setOneInchErrorMessage('');
        setOneInchStatus('');

        try {
            setIsDeletingFromDb(true);
            const result = await deleteToken(normalized);
            if (result.success) {
                setOneInchStatus(`Deleted ${normalized} from database.`);
                refreshAll();
            } else {
                setOneInchErrorMessage(result.error || 'Failed to delete token');
            }
        } catch (error) {
            setOneInchErrorMessage(error.message || 'Failed to delete token');
        } finally {
            setIsDeletingFromDb(false);
        }
    }, [deleteToken, refreshAll]);

    const handlePruneDbTokens = useCallback(async () => {
        const shouldProceed = window.confirm(
            'This will delete ALL DB tokens that do not have a RapidAPI UUID. Continue?'
        );
        if (!shouldProceed) return;

        setBulkDeleteStatus('');
        setBulkDeleteError('');

        let deleted = 0;
        let skipped = 0;
        let failed = 0;

        try {
            setIsBulkDeletingTokens(true);

            for (const token of dbTokens || []) {
                const symbol = token?.symbol?.toUpperCase();
                if (!symbol) {
                    skipped += 1;
                    continue;
                }

                const rapidCoin = rapidBySymbol[symbol];
                const hasUuid = !!rapidCoin?.uuid;

                if (hasUuid) {
                    skipped += 1;
                    continue;
                }

                const result = await deleteToken(symbol);
                if (result.success) {
                    deleted += 1;
                } else {
                    failed += 1;
                }
            }

            setBulkDeleteStatus(
                `Prune complete. Deleted ${deleted}, skipped ${skipped}, failed ${failed}.`
            );
            refreshAll();
        } catch (error) {
            setBulkDeleteError(error.message || 'Bulk delete failed');
        } finally {
            setIsBulkDeletingTokens(false);
        }
    }, [dbTokens, rapidBySymbol, oneInchBySymbol, deleteToken, refreshAll]);

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
                    expandedRows={comparisonExpandedRows}
                    onToggleExpansion={toggleComparisonExpansion}
                    onRefresh={refreshAll}
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
            ) : oneInchCompareMode ? (
                <OneInchCompareView
                    dbTokens={dbTokens}
                    oneInchTokens={oneInchFiltered}
                    oneInchLoading={oneInchLoading}
                    oneInchError={oneInchError}
                    dbCount={dbCount}
                    onClose={closeOneInchCompare}
                    onSelectSymbol={handleSelectSymbol}
                    selectedSymbol={selectedSymbol}
                    dbTokenBySymbol={dbTokenBySymbol}
                    oneInchBySymbol={oneInchBySymbol}
                    rapidBySymbol={rapidBySymbol}
                    onAddFromOneInch={handleAddFromOneInch}
                    onAddAllFromOneInch={handleAddAllFromOneInch}
                    onDeleteFromDb={handleDeleteFromDb}
                    isAddingFromOneInch={isAddingFromOneInch}
                    isBulkAddingFromOneInch={isBulkAddingFromOneInch}
                    isDeletingFromDb={isDeletingFromDb}
                    oneInchStatus={oneInchStatus}
                    oneInchErrorMessage={oneInchErrorMessage}
                    dbSearch={dbOneInchSearch}
                    onDbSearch={setDbOneInchSearch}
                    oneInchSearch={oneInchSearch}
                    onOneInchSearch={setOneInchSearch}
                    dbFiltered={dbOneInchFiltered}
                    onRefresh={refreshAll}
                    chainOptions={chainOptions}
                    oneInchChainKey={oneInchChainKey}
                    onChainChange={handleChainChange}
                />
            ) : (
                <NormalView 
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    filteredAndSortedTokens={filteredAndSortedTokens}
                    expandedRows={expandedRows}
                    onToggleExpansion={toggleRowExpansion}
                    autoEditRows={autoEditRows}
                    onOpenEditor={openInlineEditor}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                    formatPrice={formatPrice}
                    formatMarketCap={formatMarketCap}
                    dbTokenBySymbol={dbTokenBySymbol}
                    toggleComparisonMode={toggleComparisonMode}
                    setAddingToken={setAddingToken}
                    errorDb={errorDb}
                    errorJson={errorJson}
                    loadingDb={loadingDb}
                    loadingJson={loadingJson}
                    dbCount={dbCount}
                    jsonCount={jsonCount}
                    onOpenOneInch={() => setOneInchCompareMode(true)}
                    onRefresh={refreshAll}
                    onPruneDbTokens={handlePruneDbTokens}
                    isBulkDeletingTokens={isBulkDeletingTokens}
                    pruneCandidateCount={pruneCandidateCount}
                    bulkDeleteStatus={bulkDeleteStatus}
                    bulkDeleteError={bulkDeleteError}
                />
            )}
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
    autoEditRows,
    onOpenEditor,
    sortConfig,
    onSort,
    formatPrice,
    formatMarketCap,
    dbTokenBySymbol,
    toggleComparisonMode,
    setAddingToken,
    errorDb,
    errorJson,
    loadingDb,
    loadingJson,
    dbCount,
    jsonCount,
    onOpenOneInch,
    onRefresh,
    onPruneDbTokens,
    isBulkDeletingTokens,
    pruneCandidateCount,
    bulkDeleteStatus,
    bulkDeleteError
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
                        onClick={onPruneDbTokens}
                        className="danger-btn"
                        disabled={isBulkDeletingTokens || pruneCandidateCount === 0}
                    >
                        {isBulkDeletingTokens ? '🗑️ Pruning...' : '🗑️ Prune DB'}
                    </button>
                    <button
                        onClick={onOpenOneInch}
                        className="add-token-btn"
                    >
                        🧩 Compare 1inch
                    </button>
                    
                    <button 
                        onClick={toggleComparisonMode} 
                        className="comparison-toggle"
                    >
                        🔍 Compare DB vs JSON
                    </button>
                </div>
            </div>

            {(bulkDeleteStatus || bulkDeleteError) && (
                <div className="comparison-status">
                    {bulkDeleteError && (
                        <div className="save-status save-status-error">{bulkDeleteError}</div>
                    )}
                    {bulkDeleteStatus && (
                        <div className="save-status save-status-success">{bulkDeleteStatus}</div>
                    )}
                </div>
            )}

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
                    autoEditRows={autoEditRows}
                    onOpenEditor={onOpenEditor}
                    sortConfig={sortConfig}
                    onSort={onSort}
                    formatPrice={formatPrice}
                    formatMarketCap={formatMarketCap}
                    dbTokenBySymbol={dbTokenBySymbol}
                    onRefresh={onRefresh}
                />
            </div>
        </>
    );
});

// 1inch Compare View (DB vs 1inch)
const OneInchCompareView = React.memo(function OneInchCompareView({
    dbTokens,
    oneInchTokens,
    oneInchLoading,
    oneInchError,
    dbCount,
    onClose,
    onSelectSymbol,
    selectedSymbol,
    dbTokenBySymbol,
    oneInchBySymbol,
    rapidBySymbol,
    onAddFromOneInch,
    onAddAllFromOneInch,
    onDeleteFromDb,
    isAddingFromOneInch,
    isBulkAddingFromOneInch,
    isDeletingFromDb,
    oneInchStatus,
    oneInchErrorMessage,
    dbSearch,
    onDbSearch,
    oneInchSearch,
    onOneInchSearch,
    dbFiltered,
    onRefresh,
    chainOptions,
    oneInchChainKey,
    onChainChange
}) {
    const selectedRapid = selectedSymbol ? rapidBySymbol[selectedSymbol] : null;
    const selectedOneInch = selectedSymbol ? oneInchBySymbol[selectedSymbol] : null;
    const selectedDb = selectedSymbol ? dbTokenBySymbol.get(selectedSymbol.toLowerCase()) : null;

    const handleDbSearchChange = useCallback((e) => {
        onDbSearch(e.target.value);
    }, [onDbSearch]);

    const handleOneInchSearchChange = useCallback((e) => {
        onOneInchSearch(e.target.value);
    }, [onOneInchSearch]);

    const eligibleOneInchCount = useMemo(() => {
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

        return (oneInchTokens || []).filter((token) => {
            const symbol = token?.symbol?.toUpperCase();
            if (!symbol) return false;
            const rapidCoin = rapidBySymbol[symbol];
            if (!rapidCoin?.uuid || !token?.address) return false;

            const dbToken = dbTokenBySymbol.get(symbol.toLowerCase());
            if (!dbToken) return true;

            const chains = normalizeChains(dbToken?.chains);
            const existing = chains?.[oneInchChainKey];
            return !existing || existing.toLowerCase() !== token.address.toLowerCase();
        }).length;
    }, [oneInchTokens, rapidBySymbol, dbTokenBySymbol, oneInchChainKey]);

    return (
        <>
            <div className="manager-header">
                <div className="header-left">
                    <h2>DB vs 1inch</h2>
                    <div className="data-source-info">
                        <span className="db-count">🛢️ DB: {dbCount}</span>
                        <span className={`json-count ${oneInchError ? 'error' : ''}`}>
                            🧩 1inch: {oneInchLoading ? '...' : oneInchTokens.length}
                        </span>
                    </div>
                </div>
                <div className="header-right">
                    <button onClick={onClose} className="comparison-toggle active">
                        ⬅ Back
                    </button>
                </div>
            </div>

            {(oneInchErrorMessage || oneInchStatus) && (
                <div className="comparison-status">
                    {oneInchErrorMessage && (
                        <div className="save-status save-status-error">{oneInchErrorMessage}</div>
                    )}
                    {oneInchStatus && (
                        <div className="save-status save-status-success">{oneInchStatus}</div>
                    )}
                </div>
            )}

            <div className="oneinch-compare-controls">
                <div className="view-filter">
                    <span className="filter-label">Search DB:</span>
                    <input
                        className="filter-select"
                        type="text"
                        placeholder="Symbol or name"
                        value={dbSearch}
                        onChange={handleDbSearchChange}
                    />
                </div>
                <div className="view-filter">
                    <span className="filter-label">Chain:</span>
                    <select
                        className="filter-select"
                        value={oneInchChainKey}
                        onChange={onChainChange}
                    >
                        {chainOptions.map((chain) => (
                            <option key={chain.key} value={chain.key}>
                                {chain.label} ({chain.id})
                            </option>
                        ))}
                    </select>
                </div>
                <div className="view-filter">
                    <span className="filter-label">Search 1inch:</span>
                    <input
                        className="filter-select"
                        type="text"
                        placeholder="Symbol or name"
                        value={oneInchSearch}
                        onChange={handleOneInchSearchChange}
                    />
                </div>
            </div>

            <div className="oneinch-compare-grid">
                <div className="compare-column">
                    <h4>Database Tokens</h4>
                    <div className="table-container">
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Name</th>
                                    <th>In 1inch</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(dbFiltered || []).map((token) => {
                                    const symbol = token?.symbol?.toUpperCase();
                                    const hasMatch = symbol ? !!oneInchBySymbol[symbol] : false;
                                    const isSelected = symbol && selectedSymbol === symbol;

                                    return (
                                        <tr
                                            key={token.id || symbol}
                                            className={`${hasMatch ? 'matched-row' : ''} ${isSelected ? 'selected-row' : ''}`}
                                            onClick={() => onSelectSymbol(symbol)}
                                        >
                                            <td className="symbol-cell"><strong>{symbol || '—'}</strong></td>
                                            <td>{token?.name || symbol}</td>
                                            <td>{hasMatch ? '✅' : '—'}</td>
                                            <td>
                                                <button
                                                    className="action-btn danger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteFromDb(symbol);
                                                    }}
                                                    disabled={isDeletingFromDb}
                                                >
                                                    {isDeletingFromDb ? 'Deleting...' : 'Delete'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="compare-column">
                    <div className="compare-header-row">
                        <h4>1inch Tokens</h4>
                        <button
                            className="import-btn"
                            onClick={() => onAddAllFromOneInch(oneInchTokens)}
                            disabled={isBulkAddingFromOneInch || eligibleOneInchCount === 0}
                        >
                            {isBulkAddingFromOneInch
                                ? 'Adding all...'
                                : `Add All (${eligibleOneInchCount})`}
                        </button>
                    </div>
                    <div className="table-container">
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Name</th>
                                    <th>In DB</th>
                                    <th>RapidAPI UUID</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(oneInchTokens || []).map((token) => {
                                    const symbol = token?.symbol?.toUpperCase();
                                    const inDb = symbol ? dbTokenBySymbol.has(symbol.toLowerCase()) : false;
                                    const dbToken = symbol ? dbTokenBySymbol.get(symbol.toLowerCase()) : null;
                                    const rapidCoin = symbol ? rapidBySymbol[symbol] : null;
                                    const hasUuid = !!rapidCoin?.uuid;
                                    const isSelected = symbol && selectedSymbol === symbol;
                                    const oneInchAddress = token?.address;
                                    const rawChains = dbToken?.chains;
                                    const parsedChains = typeof rawChains === 'string'
                                        ? (() => {
                                            try {
                                                return JSON.parse(rawChains);
                                            } catch (e) {
                                                return {};
                                            }
                                        })()
                                        : (rawChains || {});
                                    const existingAddress = parsedChains?.[oneInchChainKey];
                                    const addressLinked = !!oneInchAddress && existingAddress?.toLowerCase() === oneInchAddress.toLowerCase();

                                    return (
                                        <tr
                                            key={token.address || symbol}
                                            className={`${inDb ? 'matched-row' : ''} ${isSelected ? 'selected-row' : ''}`}
                                            onClick={() => onSelectSymbol(symbol)}
                                        >
                                            <td className="symbol-cell"><strong>{symbol || '—'}</strong></td>
                                            <td>{token?.name || symbol}</td>
                                            <td>{inDb ? '✅' : '—'}</td>
                                            <td>{hasUuid ? rapidCoin.uuid : '—'}</td>
                                            <td>
                                                <button
                                                    className="import-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAddFromOneInch(symbol);
                                                    }}
                                                    disabled={isAddingFromOneInch || addressLinked}
                                                >
                                                    {addressLinked
                                                        ? 'Linked'
                                                        : inDb
                                                        ? 'Update Chain'
                                                        : isAddingFromOneInch
                                                        ? 'Adding...'
                                                        : 'Add'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="oneinch-details-grid">
                <div className="details-panel">
                    <h4>DB Token Details</h4>
                    {!selectedSymbol && <div className="muted">Select a token to view DB data.</div>}
                    {selectedSymbol && !selectedDb && (
                        <div className="muted">No DB data for {selectedSymbol}.</div>
                    )}
                    {selectedDb && (
                        <AdminTokenDetails token={selectedDb} onRefresh={onRefresh} autoEdit />
                    )}
                </div>
                <div className="details-panel">
                    <h4>RapidAPI Pricing</h4>
                    {!selectedSymbol && <div className="muted">Select a token to view RapidAPI data.</div>}
                    {selectedSymbol && !selectedRapid && (
                        <div className="muted">No RapidAPI data for {selectedSymbol}.</div>
                    )}
                    {selectedRapid && (
                        <div className="details-list">
                            <div><strong>Symbol:</strong> {selectedRapid.symbol || selectedSymbol}</div>
                            <div><strong>Name:</strong> {selectedRapid.name || '—'}</div>
                            <div><strong>UUID:</strong> {selectedRapid.uuid || '—'}</div>
                            <div><strong>Price:</strong> {selectedRapid.price || '—'}</div>
                            <div><strong>Market Cap:</strong> {selectedRapid.marketCap || '—'}</div>
                            <div><strong>24h Volume:</strong> {selectedRapid.volume24h || '—'}</div>
                            <div><strong>Change:</strong> {selectedRapid.change || '—'}</div>
                            <div><strong>Rank:</strong> {selectedRapid.rank || '—'}</div>
                        </div>
                    )}
                </div>
                <div className="details-panel">
                    <h4>1inch Token Data</h4>
                    {!selectedSymbol && <div className="muted">Select a token to view 1inch data.</div>}
                    {selectedSymbol && !selectedOneInch && (
                        <div className="muted">No 1inch data for {selectedSymbol}.</div>
                    )}
                    {selectedOneInch && (
                        <pre className="json-view">{JSON.stringify(selectedOneInch, null, 2)}</pre>
                    )}
                </div>
            </div>
        </>
    );
});

// Virtualized Table Component
const VirtualizedAdminTokenTable = React.memo(function VirtualizedAdminTokenTable({ 
    tokens, 
    expandedRows,
    onToggleExpansion,
    autoEditRows,
    onOpenEditor,
    sortConfig,
    onSort,
    formatPrice,
    formatMarketCap,
    dbTokenBySymbol,
    onRefresh
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
                                    onOpenEditor(tokenId);
                        }}
                    >
                        ✎ Edit
                    </button>
                </td>
            </tr>
        );
    }, [tokens, expandedRows, formatPrice, formatMarketCap, onToggleExpansion, dbTokenBySymbol]);

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
                                                onOpenEditor(tokenId);
                                            }}
                                        >
                                            ✎ Edit
                                        </button>
                                    </td>
                                </tr>
                                
                                {isExpanded && (
                                    <tr className="details-row">
                                        <td colSpan="5">
                                            <AdminTokenDetails
                                                token={detailsToken}
                                                onRefresh={onRefresh}
                                                autoEdit={autoEditRows?.has(tokenId)}
                                            />
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
const AdminTokenDetails = React.memo(function AdminTokenDetails({ token, onRefresh, autoEdit = false }) {
    const { updateToken, loading: isSaving } = useTokenCrud();
    const [isEditing, setIsEditing] = useState(autoEdit);
    
    // Initialize editData with ALL token fields
    const [editData, setEditData] = useState(() => {
        const data = { ...token };
        // Ensure we have all the data from the token
        return data;
    });
    
    const [saveStatus, setSaveStatus] = useState(null); // null, 'saving', 'success', 'error'
    const [saveError, setSaveError] = useState('');

    const [customParams, setCustomParams] = useState(token.chains || {});
    const [newParamName, setNewParamName] = useState('');
    const [newParamValue, setNewParamValue] = useState('');

    useEffect(() => {
        setEditData({ ...token });
        setCustomParams(token.chains || {});
        if (autoEdit) {
            setIsEditing(true);
        }
    }, [token, autoEdit]);
    
    const fieldOrder = useMemo(() => (
        [
            { key: 'symbol', label: 'Symbol', type: 'text' },
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'price', label: 'Price', type: 'number' },
            { key: 'market_cap', label: 'Market Cap', type: 'number' },
            { key: 'volume_24h', label: '24h Volume', type: 'number' },
            { key: 'decimals', label: 'Decimals', type: 'number' },
            { key: 'type', label: 'Type', type: 'text' },
            { key: 'image', label: 'Image', type: 'text' },
            { key: 'uuid', label: 'UUID', type: 'text' }
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
            const editableKeys = new Set(['symbol', 'uuid', 'name', 'price', 'market_cap', 'volume_24h', 'decimals', 'type', 'image']);
            for (const [key, value] of Object.entries(editData)) {
                if (editableKeys.has(key) && value !== token[key]) {
                    changedData[key] = value;
                }
            }

            const currentCustomParams = token.chains || {};
            if (JSON.stringify(customParams) !== JSON.stringify(currentCustomParams)) {
                changedData.chains = customParams;
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

            <div className="custom-params-preview">
                <h4>Chains (JSON)</h4>
                <pre className="json-view">{JSON.stringify(customParams || {}, null, 2)}</pre>
            </div>
            
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
    expandedRows,
    onToggleExpansion,
    onRefresh,
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
                    expandedRows={expandedRows}
                    onToggleExpansion={onToggleExpansion}
                    onRefresh={onRefresh}
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
    viewMode,
    expandedRows,
    onToggleExpansion,
    onRefresh
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
                    {tokens.map(item => {
                        const isExpanded = expandedRows?.has(item.symbol);
                        return (
                            <React.Fragment key={item.symbol}>
                                <ComparisonRow 
                                    item={item}
                                    isSelected={selectedTokens.some(t => (t.symbol || t.id) === (item.symbol || item.id))}
                                    onSelect={() => onSelectToken(item)}
                                    viewMode={viewMode}
                                    isExpanded={isExpanded}
                                    onToggleExpand={() => onToggleExpansion(item.symbol)}
                                />
                                {isExpanded && item.inDatabase && item.database && (
                                    <tr className="details-row">
                                        <td colSpan="6">
                                            <AdminTokenDetails token={item.database} onRefresh={onRefresh} autoEdit />
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

// Comparison Row Component
const ComparisonRow = React.memo(function ComparisonRow({ item, isSelected, onSelect, viewMode, isExpanded, onToggleExpand }) {
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
        <tr
            className={`${rowClass} ${isSelected ? 'selected' : ''}`}
            onClick={() => {
                if (inDatabase) onToggleExpand();
            }}
        >
            <td>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onSelect}
                    onClick={(e) => e.stopPropagation()}
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