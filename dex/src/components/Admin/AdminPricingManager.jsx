// src/components/Admin/AdminPricingManager.jsx
import { useEffect, useMemo, useState } from 'react';
import { useTokens } from '../../contexts/TokenContext';
import { useBinanceWs } from '../../contexts/BinanceWsContext';
import { useRapidApi } from '../../contexts/RapidApiContext';
import { useGlobalPrices } from '../../contexts/GlobalPriceContext';
import './AdminPricingManager.css';

function AdminPricingManager() {
    const { 
        dbTokens,
        loadingAll
    } = useTokens();

    // RapidAPI cryptos (CoinRanking)
    const {
        coins: cryptoList,
        isLoading: cryptosLoading,
        error: cryptosError
    } = useRapidApi();

    const normalizeSymbolKey = (value) => {
        if (!value) return '';
        return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    };

    const cryptosBySymbol = useMemo(() => {
        const map = {};
        cryptoList.forEach((coin) => {
            const symbol = coin?.symbol?.toUpperCase();
            if (symbol) {
                map[symbol] = coin;
            }
        });
        return map;
    }, [cryptoList]);

    const cryptosByKey = useMemo(() => {
        const map = {};
        cryptoList.forEach((coin) => {
            const key = normalizeSymbolKey(coin?.symbol);
            if (key) {
                map[key] = coin;
            }
        });
        return map;
    }, [cryptoList]);

    const dbTokensBySymbol = useMemo(() => {
        const map = {};
        dbTokens.forEach((token) => {
            const symbol = token?.symbol?.toUpperCase();
            if (symbol) {
                map[symbol] = token;
            }
        });
        return map;
    }, [dbTokens]);

    // Binance mini-ticker stream (all USDT pairs)
    const { latestData, isConnected: binanceConnected } = useBinanceWs();
    const {
        prices: globalPrices,
        coinbaseConnected,
        coinbaseTotalPrices,
        coinbaseUsedPrices
    } = useGlobalPrices();
    const [liveTickerBySymbol, setLiveTickerBySymbol] = useState({});

    useEffect(() => {
        if (!Array.isArray(latestData) || latestData.length === 0) {
            return;
        }

        setLiveTickerBySymbol((prev) => {
            const next = { ...prev };
            latestData.forEach((ticker) => {
                if (ticker?.s && ticker.s.endsWith('USDT')) {
                    const base = ticker.s.replace(/USDT$/i, '').toUpperCase();
                    next[base] = {
                        s: ticker.s,
                        c: ticker.c,
                        o: ticker.o || '0',
                        lastUpdate: ticker.E || ticker.eventTime || Date.now(),
                        hasLiveData: true,
                        source: 'websocket',
                        isStale: false,
                        raw: ticker
                    };
                }
            });
            return next;
        });
    }, [latestData]);

    const [initialSnapshot, setInitialSnapshot] = useState({});
    const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
    const [coinbaseSnapshot, setCoinbaseSnapshot] = useState({});
    const [isLoadingCoinbaseSnapshot, setIsLoadingCoinbaseSnapshot] = useState(false);

    useEffect(() => {
        const fetchSnapshot = async () => {
            setIsLoadingSnapshot(true);
            try {
                const response = await fetch('/api/binance/all-prices');
                const data = await response.json();
                setInitialSnapshot(data?.prices || {});
                console.log(`📊 Initial snapshot: ${Object.keys(data?.prices || {}).length} symbols`);
            } catch (error) {
                console.error('Failed to fetch snapshot:', error);
            } finally {
                setIsLoadingSnapshot(false);
            }
        };

        fetchSnapshot();
        const interval = setInterval(fetchSnapshot, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchCoinbaseSnapshot = async () => {
            setIsLoadingCoinbaseSnapshot(true);
            try {
                const response = await fetch('/api/coinbase/all-prices');
                const data = await response.json();
                setCoinbaseSnapshot(data?.prices || {});
                console.log(`📊 Coinbase snapshot: ${Object.keys(data?.prices || {}).length} symbols`);
            } catch (error) {
                console.error('Failed to fetch Coinbase snapshot:', error);
            } finally {
                setIsLoadingCoinbaseSnapshot(false);
            }
        };

        fetchCoinbaseSnapshot();
        const interval = setInterval(fetchCoinbaseSnapshot, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const binancePairs = useMemo(() => {
        const snapshotSymbols = Object.keys(initialSnapshot || {});
        const liveSymbols = Object.keys(liveTickerBySymbol || {});
        const combinedSymbols = new Set([...liveSymbols, ...snapshotSymbols]);

        return Array.from(combinedSymbols).map((symbol) => {
            const tickerData = liveTickerBySymbol[symbol];
            const pair = `${symbol}USDT`;

            if (tickerData && tickerData.c) {
                return {
                    s: pair,
                    c: tickerData.c.toString(),
                    o: tickerData.o || '0',
                    lastUpdate: tickerData.lastUpdate,
                    hasLiveData: true,
                    source: 'websocket'
                };
            }

            if (initialSnapshot[symbol]) {
                return {
                    s: pair,
                    c: initialSnapshot[symbol].price?.toString() || '0',
                    o: '0',
                    lastUpdate: initialSnapshot[symbol].timestamp,
                    hasLiveData: false,
                    source: 'snapshot',
                    isStale: true
                };
            }

            return {
                s: pair,
                c: '0',
                o: '0',
                lastUpdate: null,
                hasLiveData: false,
                source: 'unknown',
                isStale: true
            };
        });
    }, [liveTickerBySymbol, initialSnapshot]);

    const binanceKeySet = useMemo(() => {
        return new Set(binancePairs.map((ticker) => normalizeSymbolKey(ticker?.s?.replace(/USDT$/, ''))));
    }, [binancePairs]);

    const mergedRows = useMemo(() => {
        const rows = binancePairs.map((ticker) => {
            const pair = ticker.s;
            const base = pair.replace(/USDT$/, '');
            const key = normalizeSymbolKey(base);
            const apiCoin = cryptosBySymbol[base] || cryptosByKey[key];
            const dbToken = dbTokensBySymbol[base];
            const priceEntry = globalPrices?.[base?.toUpperCase()];

            const binancePrice = parseFloat(ticker.c || 0);
            const apiPrice = apiCoin?.price ? parseFloat(apiCoin.price) : null;
            const coinbasePrice = priceEntry?.coinbasePrice ?? coinbaseSnapshot?.[base?.toUpperCase()]?.price ?? null;

            return {
                pair,
                symbol: base,
                name: apiCoin?.name || dbToken?.name || base,
                uuid: apiCoin?.uuid || dbToken?.uuid,
                dbPrice: dbToken?.price ?? null,
                hasDbToken: !!dbToken,
                apiPrice,
                binancePrice,
                coinbasePrice,
                priceSource: ticker.isStale ? 'stale' : 'binance',
                isStreaming: !ticker.isStale && binanceConnected,
                isStale: !!ticker.isStale,
                lastUpdate: ticker.lastUpdate,
                updated_at: dbToken?.updated_at,
                apiCoin,
                raw: ticker
            };
        });

        const rapidOnlyRows = cryptoList
            .filter((coin) => {
                const key = normalizeSymbolKey(coin?.symbol);
                return key && !binanceKeySet.has(key);
            })
            .map((coin) => {
                const symbol = coin?.symbol?.toUpperCase() || '';
                const dbToken = dbTokensBySymbol[symbol];
                const priceEntry = globalPrices?.[symbol];
                const coinbasePrice = priceEntry?.coinbasePrice ?? coinbaseSnapshot?.[symbol]?.price ?? null;

                return {
                    pair: symbol ? `${symbol}USDT` : '—',
                    symbol: symbol || '—',
                    name: coin?.name || dbToken?.name || symbol,
                    uuid: coin?.uuid || dbToken?.uuid,
                    dbPrice: dbToken?.price ?? null,
                    hasDbToken: !!dbToken,
                    apiPrice: coin?.price ? parseFloat(coin.price) : null,
                    binancePrice: null,
                    coinbasePrice,
                    priceSource: 'rapidapi',
                    isStreaming: false,
                    isStale: true,
                    lastUpdate: null,
                    updated_at: dbToken?.updated_at,
                    apiCoin: coin,
                    raw: null
                };
            });

        return [...rows, ...rapidOnlyRows];
    }, [binancePairs, cryptosBySymbol, cryptosByKey, dbTokensBySymbol, binanceConnected, cryptoList, binanceKeySet, globalPrices, coinbaseSnapshot]);

    const mergedRowsBySymbol = useMemo(() => {
        const map = {};
        mergedRows.forEach((row) => {
            if (row?.symbol) {
                map[row.symbol] = row;
            }
        });
        return map;
    }, [mergedRows]);

    const streamingCount = binancePairs.length;
    const found = mergedRows.filter(row => row.apiPrice !== null).length;
    const pricesLoading = cryptosLoading;
    const pricesError = cryptosError;
    
    const [viewMode, setViewMode] = useState('all'); // 'all', 'mismatch', 'noPrice'
    const [selectedTokens, setSelectedTokens] = useState([]);
    const [showPriceDetails, setShowPriceDetails] = useState(false);
    const [showBinanceSection, setShowBinanceSection] = useState(false);
    const [showRapidSection, setShowRapidSection] = useState(false);
    const [showComparisonSection, setShowComparisonSection] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'asc' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(100);
    const [binancePage, setBinancePage] = useState(1);
    const [binancePageSize, setBinancePageSize] = useState(100);
    const [binanceSortConfig, setBinanceSortConfig] = useState({ key: 'symbol', direction: 'asc' });
    const [rapidPage, setRapidPage] = useState(1);
    const [rapidPageSize, setRapidPageSize] = useState(100);
    const [rapidSortConfig, setRapidSortConfig] = useState({ key: 'symbol', direction: 'asc' });

    // Filter tokens based on view mode
    const filteredTokens = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = (token) => {
            if (!term) return true;
            return (
                token.symbol?.toLowerCase().includes(term) ||
                token.name?.toLowerCase().includes(term) ||
                token.pair?.toLowerCase().includes(term)
            );
        };

        const matchesView = (token) => {
            switch(viewMode) {
                case 'mismatch':
                    return token.apiPrice && token.binancePrice &&
                           Math.abs(token.apiPrice - token.binancePrice) > (token.apiPrice * 0.01);
                case 'noPrice':
                    return !token.apiPrice;
                default:
                    return true;
            }
        };

        const getSortValue = (token) => {
            switch (sortConfig.key) {
                case 'symbol':
                    return token.symbol?.toLowerCase() || '';
                case 'name':
                    return token.name?.toLowerCase() || '';
                case 'apiPrice':
                    return token.apiPrice ?? -1;
                case 'binancePrice':
                    return token.binancePrice ?? -1;
                case 'difference':
                    if (!token.apiPrice || !token.binancePrice) return -Infinity;
                    return (token.binancePrice - token.apiPrice) / token.apiPrice;
                case 'marketCap':
                    return token.apiCoin?.marketCap ? parseFloat(token.apiCoin.marketCap) : -1;
                default:
                    return token.symbol?.toLowerCase() || '';
            }
        };

        const dir = sortConfig.direction === 'asc' ? 1 : -1;

        return mergedRows
            .filter(token => matchesView(token) && matchesSearch(token))
            .sort((a, b) => {
                const aVal = getSortValue(a);
                const bVal = getSortValue(b);
                if (aVal < bVal) return -1 * dir;
                if (aVal > bVal) return 1 * dir;
                return 0;
            });
    }, [mergedRows, viewMode, searchTerm, sortConfig]);

    const totalPages = useMemo(() => {
        if (pageSize === 0) return 1;
        return Math.max(1, Math.ceil(filteredTokens.length / pageSize));
    }, [filteredTokens.length, pageSize]);

    const paginatedTokens = useMemo(() => {
        if (pageSize === 0) return filteredTokens;
        const start = (page - 1) * pageSize;
        return filteredTokens.slice(start, start + pageSize);
    }, [filteredTokens, page, pageSize]);

    const matchingSymbolsCount = useMemo(() => {
        return cryptoList.filter(coin => {
            const key = normalizeSymbolKey(coin?.symbol);
            return key && binanceKeySet.has(key);
        }).length;
    }, [cryptoList, binanceKeySet]);

    const binanceOnlySymbols = useMemo(() => {
        const rapidKeySet = new Set(cryptoList
            .map(coin => normalizeSymbolKey(coin?.symbol))
            .filter(Boolean));
        return binancePairs
            .map(ticker => ticker?.s?.replace(/USDT$/, ''))
            .filter(Boolean)
            .filter(symbol => !rapidKeySet.has(normalizeSymbolKey(symbol)));
    }, [binancePairs, cryptoList]);

    const rapidOnlySymbols = useMemo(() => {
        return cryptoList
            .map(coin => coin?.symbol?.toUpperCase())
            .filter(Boolean)
            .filter(symbol => !binanceKeySet.has(normalizeSymbolKey(symbol)));
    }, [cryptoList, binanceKeySet]);

    const binanceTotalPages = useMemo(() => {
        if (binancePageSize === 0) return 1;
        return Math.max(1, Math.ceil(binancePairs.length / binancePageSize));
    }, [binancePairs.length, binancePageSize]);

    const binancePaginated = useMemo(() => {
        const getSortValue = (ticker) => {
            const pair = ticker?.s || '';
            const symbol = pair.replace(/USDT$/, '');
            const last = parseFloat(ticker?.c || 0);
            const open = parseFloat(ticker?.o || 0);
            const change = open ? ((last - open) / open) * 100 : 0;

            switch (binanceSortConfig.key) {
                case 'symbol':
                    return symbol.toLowerCase();
                case 'price':
                    return last;
                case 'change':
                    return change;
                default:
                    return symbol.toLowerCase();
            }
        };

        const dir = binanceSortConfig.direction === 'asc' ? 1 : -1;
        const sorted = [...binancePairs].sort((a, b) => {
            const aVal = getSortValue(a);
            const bVal = getSortValue(b);
            if (aVal < bVal) return -1 * dir;
            if (aVal > bVal) return 1 * dir;
            return 0;
        });

        if (binancePageSize === 0) return sorted;
        const start = (binancePage - 1) * binancePageSize;
        return sorted.slice(start, start + binancePageSize);
    }, [binancePairs, binancePage, binancePageSize, binanceSortConfig]);

    const rapidTotalPages = useMemo(() => {
        if (rapidPageSize === 0) return 1;
        return Math.max(1, Math.ceil(cryptoList.length / rapidPageSize));
    }, [cryptoList.length, rapidPageSize]);

    const rapidPaginated = useMemo(() => {
        const getSortValue = (coin) => {
            switch (rapidSortConfig.key) {
                case 'symbol':
                    return coin?.symbol?.toUpperCase() || '';
                case 'name':
                    return coin?.name?.toLowerCase() || '';
                case 'price':
                    return coin?.price ? parseFloat(coin.price) : -1;
                case 'marketCap':
                    return coin?.marketCap ? parseFloat(coin.marketCap) : -1;
                case 'change':
                    return coin?.change ? parseFloat(coin.change) : -Infinity;
                default:
                    return coin?.symbol?.toUpperCase() || '';
            }
        };

        const dir = rapidSortConfig.direction === 'asc' ? 1 : -1;
        const sorted = [...cryptoList].sort((a, b) => {
            const aVal = getSortValue(a);
            const bVal = getSortValue(b);
            if (aVal < bVal) return -1 * dir;
            if (aVal > bVal) return 1 * dir;
            return 0;
        });

        if (rapidPageSize === 0) return sorted;
        const start = (rapidPage - 1) * rapidPageSize;
        return sorted.slice(start, start + rapidPageSize);
    }, [cryptoList, rapidPage, rapidPageSize, rapidSortConfig]);

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
                const token = dbTokensBySymbol[symbol];
                const row = mergedRowsBySymbol[symbol];
                return {
                    symbol,
                    newPrice: row?.binancePrice,
                    oldPrice: token?.price,
                    hasDbToken: !!token
                };
            }).filter(update => update.newPrice && update.hasDbToken);
            
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
                            <span className="stat-label">Binance Pairs:</span>
                            <span className={`stat-value ${streamingCount > 0 ? 'streaming' : ''}`}>
                                {streamingCount} USDT pairs
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">RapidAPI Coins:</span>
                            <span className="stat-value">{cryptoList.length}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Coinbase Prices:</span>
                            <span className="stat-value">{coinbaseTotalPrices || 0}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Coinbase Used:</span>
                            <span className="stat-value">{coinbaseUsedPrices || 0}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Symbol Matches:</span>
                            <span className="stat-value">{matchingSymbolsCount}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Binance-only:</span>
                            <span className="stat-value">{binanceOnlySymbols.length}</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Rapid-only:</span>
                            <span className="stat-value">{rapidOnlySymbols.length}</span>
                        </div>
                    </div>
                </div>
                
                <div className="header-right">
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
                    <div className="section-toggle-group">
                        <button
                            className={`section-toggle ${showBinanceSection ? 'active' : ''}`}
                            onClick={() => setShowBinanceSection(prev => !prev)}
                        >
                            {showBinanceSection ? 'Hide Binance' : 'Show Binance'}
                        </button>
                        <button
                            className={`section-toggle ${showRapidSection ? 'active' : ''}`}
                            onClick={() => setShowRapidSection(prev => !prev)}
                        >
                            {showRapidSection ? 'Hide RapidAPI' : 'Show RapidAPI'}
                        </button>
                        <button
                            className={`section-toggle ${showComparisonSection ? 'active' : ''}`}
                            onClick={() => setShowComparisonSection(prev => !prev)}
                        >
                            {showComparisonSection ? 'Hide Compare' : 'Show Compare'}
                        </button>
                    </div>
                    <div className="search-sort-controls">
                        <input
                            type="text"
                            className="view-select"
                            placeholder="Search symbol, name, pair..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                        />
                        <select
                            className="view-select"
                            value={sortConfig.key}
                            onChange={(e) => setSortConfig(prev => ({ ...prev, key: e.target.value }))}
                        >
                            <option value="symbol">Sort: Symbol</option>
                            <option value="name">Sort: Name</option>
                            <option value="apiPrice">Sort: RapidAPI Price</option>
                            <option value="binancePrice">Sort: Binance Price</option>
                            <option value="difference">Sort: Difference %</option>
                            <option value="marketCap">Sort: Market Cap</option>
                        </select>
                        <button
                            className="update-btn"
                            onClick={() => setSortConfig(prev => ({
                                ...prev,
                                direction: prev.direction === 'asc' ? 'desc' : 'asc'
                            }))}
                        >
                            {sortConfig.direction === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                    </div>
                </div>
                
                {pricesError && (
                    <div className="error-alert">
                        ❌ Pricing Error: {pricesError.message}
                    </div>
                )}
            </div>

            {/* Binance Section */}
            {showBinanceSection && (
                <div className="section">
                    <div className="section-header">
                        <h3>Binance USDT Pairs</h3>
                        <div className="search-sort-controls">
                            <select
                                className="view-select"
                                value={binanceSortConfig.key}
                                onChange={(e) => {
                                    setBinanceSortConfig(prev => ({ ...prev, key: e.target.value }));
                                    setBinancePage(1);
                                }}
                            >
                                <option value="symbol">Sort: Symbol</option>
                                <option value="price">Sort: Price</option>
                                <option value="change">Sort: 24h Change</option>
                            </select>
                            <button
                                className="update-btn"
                                onClick={() => setBinanceSortConfig(prev => ({
                                    ...prev,
                                    direction: prev.direction === 'asc' ? 'desc' : 'asc'
                                }))}
                            >
                                {binanceSortConfig.direction === 'asc' ? 'Asc' : 'Desc'}
                            </button>
                            <select
                                value={binancePageSize}
                                onChange={(e) => {
                                    const nextSize = parseInt(e.target.value, 10);
                                    setBinancePageSize(nextSize);
                                    setBinancePage(1);
                                }}
                                className="view-select"
                            >
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                                <option value={250}>250 / page</option>
                                <option value={0}>All</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-container">
                        <BinanceTable pairs={binancePaginated} />
                    </div>

                    {binancePageSize !== 0 && binanceTotalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="update-btn"
                                onClick={() => setBinancePage(prev => Math.max(1, prev - 1))}
                                disabled={binancePage <= 1}
                            >
                                Prev
                            </button>
                            <span className="pagination-info">
                                Page {binancePage} of {binanceTotalPages}
                            </span>
                            <button
                                className="update-btn"
                                onClick={() => setBinancePage(prev => Math.min(binanceTotalPages, prev + 1))}
                                disabled={binancePage >= binanceTotalPages}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* RapidAPI Section */}
            {showRapidSection && (
                <div className="section">
                    <div className="section-header">
                        <h3>RapidAPI Coins</h3>
                        <div className="search-sort-controls">
                            <select
                                className="view-select"
                                value={rapidSortConfig.key}
                                onChange={(e) => {
                                    setRapidSortConfig(prev => ({ ...prev, key: e.target.value }));
                                    setRapidPage(1);
                                }}
                            >
                                <option value="symbol">Sort: Symbol</option>
                                <option value="name">Sort: Name</option>
                                <option value="price">Sort: Price</option>
                                <option value="marketCap">Sort: Market Cap</option>
                                <option value="change">Sort: 24h Change</option>
                            </select>
                            <button
                                className="update-btn"
                                onClick={() => setRapidSortConfig(prev => ({
                                    ...prev,
                                    direction: prev.direction === 'asc' ? 'desc' : 'asc'
                                }))}
                            >
                                {rapidSortConfig.direction === 'asc' ? 'Asc' : 'Desc'}
                            </button>
                            <select
                                value={rapidPageSize}
                                onChange={(e) => {
                                    const nextSize = parseInt(e.target.value, 10);
                                    setRapidPageSize(nextSize);
                                    setRapidPage(1);
                                }}
                                className="view-select"
                            >
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                                <option value={250}>250 / page</option>
                                <option value={0}>All</option>
                            </select>
                        </div>
                    </div>
                    <div className="table-container">
                        <RapidApiTable coins={rapidPaginated} />
                    </div>

                    {rapidPageSize !== 0 && rapidTotalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="update-btn"
                                onClick={() => setRapidPage(prev => Math.max(1, prev - 1))}
                                disabled={rapidPage <= 1}
                            >
                                Prev
                            </button>
                            <span className="pagination-info">
                                Page {rapidPage} of {rapidTotalPages}
                            </span>
                            <button
                                className="update-btn"
                                onClick={() => setRapidPage(prev => Math.min(rapidTotalPages, prev + 1))}
                                disabled={rapidPage >= rapidTotalPages}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Comparison Section */}
            {showComparisonSection && (
                <div className="section">
                    <div className="section-header">
                        <h3>Compare Binance vs RapidAPI</h3>
                        <div className="compare-controls">
                            <select 
                                value={viewMode} 
                                onChange={(e) => setViewMode(e.target.value)}
                                className="view-select"
                            >
                                <option value="all">All Tokens</option>
                                <option value="mismatch">Price Mismatch ({'>'}1%)</option>
                                <option value="noPrice">No API Match</option>
                            </select>

                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    const nextSize = parseInt(e.target.value, 10);
                                    setPageSize(nextSize);
                                    setPage(1);
                                }}
                                className="view-select"
                            >
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                                <option value={250}>250 / page</option>
                                <option value={0}>All</option>
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
                    </div>

                    <div className="table-container">
                        <PricingTable 
                            tokens={paginatedTokens}
                            selectedTokens={selectedTokens}
                            onSelectToken={toggleTokenSelection}
                            wsConnected={binanceConnected}
                            coinbaseConnected={coinbaseConnected}
                        />
                    </div>

                    {pageSize !== 0 && totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="update-btn"
                                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                disabled={page <= 1}
                            >
                                Prev
                            </button>
                            <span className="pagination-info">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                className="update-btn"
                                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages}
                            >
                                Next
                            </button>
                        </div>
                    )}

                    <div className="section-split">
                        <div className="table-container">
                            <h4>Binance Pairs Missing in RapidAPI</h4>
                            <SymbolListTable symbols={binanceOnlySymbols} />
                        </div>

                        <div className="table-container">
                            <h4>RapidAPI Coins Missing in Binance</h4>
                            <SymbolListTable symbols={rapidOnlySymbols} />
                        </div>
                    </div>
                </div>
            )}

            {/* Price Stats */}
            {showPriceDetails && (
                <div className="price-stats">
                    <h3>Price Statistics</h3>
                    <div className="stats-grid">
                        {mergedRows.slice(0, 50).map((row) => (
                            <div key={row.pair} className="price-stat-card">
                                <div className="stat-symbol">{row.pair}</div>
                                <div className="stat-price">${row.binancePrice?.toFixed(4)}</div>
                                <div className="stat-source">binance</div>
                                <div className="stat-time">
                                    {binanceConnected ? 'LIVE' : 'Connecting...'}
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
function PricingTable({ tokens, selectedTokens, onSelectToken, wsConnected, coinbaseConnected }) {
    return (
        <table className="pricing-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Pair</th>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>RapidAPI Price</th>
                    <th>Binance WS Price</th>
                    <th>Coinbase WS Price</th>
                    <th>Source</th>
                    <th>Difference</th>
                    <th>WS Active</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                {tokens.map(token => {
                    const apiPrice = token.apiPrice;
                    const binancePrice = token.binancePrice;
                    const difference = apiPrice && binancePrice ? 
                        ((binancePrice - apiPrice) / apiPrice * 100).toFixed(2) : null;
                    
                    return (
                        <PricingRow 
                            key={token.pair}
                            token={token}
                            apiPrice={apiPrice}
                            binancePrice={binancePrice}
                            coinbasePrice={token.coinbasePrice}
                            difference={difference}
                            isSelected={selectedTokens.includes(token.symbol)}
                            onSelect={() => onSelectToken(token.symbol)}
                            wsConnected={wsConnected}
                            coinbaseConnected={coinbaseConnected}
                        />
                    );
                })}
            </tbody>
        </table>
    );
}

// Pricing Row Component
function PricingRow({
    token,
    apiPrice,
    binancePrice,
    coinbasePrice,
    difference,
    isSelected,
    onSelect,
    wsConnected,
    coinbaseConnected
}) {
    const hasBinancePricing = binancePrice !== null && binancePrice !== undefined;
    const hasCoinbasePricing = coinbasePrice !== null && coinbasePrice !== undefined;
    const getRowClass = () => {
        if (token.isStale) return 'stale';
        if (!apiPrice) return 'no-price';
        if (difference && Math.abs(difference) > 1) return 'mismatch';
        if (token.isStreaming) return 'streaming';
        return '';
    };

    const getStatusBadge = () => {
        if (token.isStale) return { text: '🔄 STALE', class: 'stale' };
        if (!apiPrice) return { text: 'No API Match', class: 'error' };
        if (token.isStreaming) return { text: '● LIVE', class: 'live' };
        return { text: 'Cached', class: 'cached' };
    };

    const status = getStatusBadge();
    const wsActive = token.isStreaming && !token.isStale;

    return (
        <tr className={`${getRowClass()} ${isSelected ? 'selected' : ''}`}>
            <td>
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onSelect}
                    disabled={!binancePrice || !token.hasDbToken}
                />
            </td>
            <td className="pair-cell">
                <strong>{token.pair}</strong>
            </td>
            <td className="symbol-cell">
                <strong>{token.symbol}</strong>
            </td>
            <td>{token.name}</td>

            {/* API Price */}
            <td className="api-price-cell">
                {apiPrice ? `$${apiPrice.toFixed(4)}` : '—'}
            </td>
            
            {/* Binance Price */}
            <td className="current-price-cell">
                {binancePrice ? (
                    <div>
                        <div className="price-value">${binancePrice.toFixed(4)}</div>
                    </div>
                ) : (
                    <span className="no-price-text">—</span>
                )}
            </td>

            {/* Coinbase Price */}
            <td className="current-price-cell">
                {coinbasePrice ? (
                    <div>
                        <div className="price-value">${coinbasePrice.toFixed(4)}</div>
                    </div>
                ) : (
                    <span className="no-price-text">—</span>
                )}
            </td>
            
            {/* Source */}
            <td className="source-cell">
                {hasBinancePricing ? (
                    <span className="source-badge binance">binance</span>
                ) : (coinbaseConnected && hasCoinbasePricing ? (
                    <span className="source-badge coinbase">coinbase</span>
                ) : (
                    <span className="source-badge rapidapi">RapidApi</span>
                ))}
            </td>
            
            {/* Difference */}
            <td className="difference-cell">
                {difference ? (
                    <span className={`difference ${parseFloat(difference) >= 0 ? 'positive' : 'negative'}`}>
                        {parseFloat(difference) >= 0 ? '▲' : '▼'} {Math.abs(difference)}%
                    </span>
                ) : '—'}
            </td>

            <td className="ws-status-cell compact-cell">
                <span className={`ws-badge ${wsActive ? 'active' : 'inactive'}`}>
                    {wsActive ? 'WS Active' : 'WS Inactive'}
                </span>
            </td>
            
            {/* Status */}
            <td className="status-cell compact-cell">
                <span className={`status-badge ${status.class}`}>
                    {status.text}
                </span>
            </td>
        </tr>
    );
}

export default AdminPricingManager;

function BinanceTable({ pairs }) {
    return (
        <table className="pricing-table">
            <thead>
                <tr>
                    <th>Pair</th>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>24h Change</th>
                </tr>
            </thead>
            <tbody>
                {pairs.map((ticker) => {
                    const pair = ticker.s;
                    const symbol = pair.replace(/USDT$/, '');
                    const last = parseFloat(ticker.c || 0);
                    const open = parseFloat(ticker.o || 0);
                    const change = open ? ((last - open) / open) * 100 : 0;

                    return (
                        <tr key={pair}>
                            <td className="pair-cell"><strong>{pair}</strong></td>
                            <td className="symbol-cell"><strong>{symbol}</strong></td>
                            <td>${last.toFixed(4)}</td>
                            <td className={change >= 0 ? 'positive' : 'negative'}>
                                {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function RapidApiTable({ coins }) {
    return (
        <table className="pricing-table">
            <thead>
                <tr>
                    <th>Symbol</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Rank</th>
                    <th>Market Cap</th>
                    <th>24h Change</th>
                </tr>
            </thead>
            <tbody>
                {coins.map((coin) => {
                    const symbol = coin?.symbol?.toUpperCase();
                    const price = coin?.price ? parseFloat(coin.price) : null;
                    const change = coin?.change ? parseFloat(coin.change) : null;
                    const marketCap = coin?.marketCap ? parseFloat(coin.marketCap) : null;

                    return (
                        <tr key={coin.uuid || symbol}>
                            <td className="symbol-cell"><strong>{symbol}</strong></td>
                            <td>{coin?.name || symbol}</td>
                            <td>{price ? `$${price.toFixed(4)}` : '—'}</td>
                            <td>{coin?.rank || '—'}</td>
                            <td>{marketCap ? `$${marketCap.toLocaleString()}` : '—'}</td>
                            <td className={change >= 0 ? 'positive' : 'negative'}>
                                {change !== null ? `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%` : '—'}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

function SymbolListTable({ symbols }) {
    return (
        <table className="pricing-table">
            <thead>
                <tr>
                    <th>Symbol</th>
                    <th>USDT Pair</th>
                </tr>
            </thead>
            <tbody>
                {symbols.map((symbol, index) => (
                    <tr key={`${symbol}-${index}`}>
                        <td className="symbol-cell"><strong>{symbol}</strong></td>
                        <td>{symbol}USDT</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}