import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export const useChainlink = (options = {}) => {
    const {
        chain: defaultChain = 'ethereum',
        autoRefresh = true,
        refreshInterval = 30000
    } = options;

    const [chain, setChain] = useState(defaultChain);
    const [feeds, setFeeds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchFeeds = useCallback(async (targetChain = chain) => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${API_BASE}/oracle/feeds/${targetChain}`);

            if (response.data.success) {
                setFeeds(response.data.feeds);
                setChain(targetChain);
                return response.data.feeds;
            }

            throw new Error(response.data.error || 'Failed to fetch feeds');
        } catch (err) {
            console.error(`Error fetching Chainlink feeds for ${targetChain}:`, err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [chain]);

    useEffect(() => {
        fetchFeeds();
    }, []);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchFeeds, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchFeeds]);

    return {
        chain,
        feeds,
        loading,
        error,
        setChain,
        refreshFeeds: fetchFeeds,
        getFeedForToken: (tokenSymbol) => {
            const normalizedSymbol = tokenSymbol.toUpperCase();
            return feeds.find((feed) =>
                feed.name?.toUpperCase().includes(`${normalizedSymbol}/USD`) ||
                feed.asset?.toUpperCase() === normalizedSymbol
            );
        },
        searchFeeds: (query) => {
            if (!query) return feeds;
            const lowerQuery = query.toLowerCase();
            return feeds.filter((feed) =>
                feed.name?.toLowerCase().includes(lowerQuery) ||
                feed.asset?.toLowerCase().includes(lowerQuery)
            );
        }
    };
};

export const useChainlinkPrice = (tokenSymbol, chain = 'ethereum', options = {}) => {
    const {
        autoRefresh = true,
        refreshInterval = 10000,
        maxHistory = 100,
        fetchOnMount = true
    } = options;

    const [priceData, setPriceData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [history, setHistory] = useState([]);
    const [currentChain, setCurrentChain] = useState(chain);

    const fetchPrice = useCallback(async (targetToken = tokenSymbol, targetChain = currentChain) => {
        if (!targetToken || !targetChain) return;

        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(
                `${API_BASE}/oracle/price/${targetChain}/${targetToken}`
            );

            if (response.data.success) {
                const newData = {
                    ...response.data,
                    fetchedAt: new Date(),
                    timestamp: Date.now()
                };

                setPriceData(newData);
                setCurrentChain(targetChain);

                setHistory((prev) => {
                    const updated = [newData, ...prev];
                    return updated.slice(0, maxHistory);
                });

                return newData;
            }

            throw new Error(response.data.error || 'Failed to fetch price');
        } catch (err) {
            console.error(`Error fetching price for ${targetToken}:`, err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [tokenSymbol, currentChain, maxHistory]);

    useEffect(() => {
        if (fetchOnMount && tokenSymbol) {
            fetchPrice();
        }
    }, [fetchPrice, fetchOnMount, tokenSymbol]);

    useEffect(() => {
        if (!autoRefresh || !tokenSymbol) return;
        const interval = setInterval(fetchPrice, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchPrice, tokenSymbol]);

    return {
        price: priceData?.price,
        priceData,
        loading,
        error,
        chain: currentChain,
        token: tokenSymbol,
        history,
        historyCount: history.length,
        refresh: fetchPrice,
        setToken: (newToken) => fetchPrice(newToken, currentChain),
        setChain: (newChain) => fetchPrice(tokenSymbol, newChain),
        getPriceChange: (period = 1) => {
            if (history.length < period + 1) return null;
            const current = history[0]?.price;
            const past = history[period]?.price;
            if (!current || !past) return null;
            return {
                percentage: ((current - past) / past) * 100,
                absolute: current - past,
                period
            };
        },
        formatPrice: (value = priceData?.price, decimals = 2) => {
            if (!value) return 'N/A';
            return new Intl.NumberFormat('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            }).format(value);
        }
    };
};

export const useChainlinkBatchPrices = (tokenSymbols, chain = 'ethereum', options = {}) => {
    const {
        autoRefresh = false,
        refreshInterval = 10 * 60 * 1000,
        limit = 50
    } = options;

    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    const fetchPrices = useCallback(async (tokens = tokenSymbols, targetChain = chain) => {
        if (!targetChain) return;

        setLoading(true);
        setError(null);

        try {
            const payload = {
                chain: targetChain
            };

            if (Array.isArray(tokens) && tokens.length > 0) {
                payload.tokens = tokens;
            } else {
                payload.limit = limit;
            }

            const response = await axios.post(`${API_BASE}/oracle/batch-prices`, payload);

            if (response.data.success) {
                const priceMap = {};
                response.data.prices.forEach((item) => {
                    if (item.price !== null && !item.error) {
                        priceMap[item.token] = item;
                    }
                });
                setPrices((prev) => ({
                    ...prev,
                    ...priceMap
                }));
                setLastUpdated(Date.now());
                return priceMap;
            }

            throw new Error(response.data.error || 'Failed to fetch batch prices');
        } catch (err) {
            console.error('Error fetching batch prices:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [tokenSymbols, chain, limit]);

    useEffect(() => {
        fetchPrices();
    }, [fetchPrices]);

    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchPrices, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchPrices]);

    return {
        prices,
        loading,
        error,
        lastUpdated,
        refresh: fetchPrices,
        getPrice: (token) => prices[token]?.price,
        getPriceData: (token) => prices[token],
        formatAllPrices: () => {
            return Object.entries(prices).reduce((acc, [token, data]) => {
                acc[token] = new Intl.NumberFormat('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(data.price);
                return acc;
            }, {});
        }
    };
};

export const useChainlinkChartData = (tokenSymbol, chain = 'ethereum', options = {}) => {
    const {
        dataPoints = 50,
        interval = 60000,
        autoRefresh = true
    } = options;

    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { priceData, refresh } = useChainlinkPrice(tokenSymbol, chain, {
        autoRefresh,
        refreshInterval: interval,
        maxHistory: dataPoints
    });

    useEffect(() => {
        if (!priceData?.history) return;

        const transformed = priceData.history.map((point) => ({
            x: new Date(point.updatedAt || point.fetchedAt),
            y: point.price,
            roundId: point.roundId,
            timestamp: point.timestamp
        })).reverse();

        setChartData(transformed);
    }, [priceData?.history]);

    return {
        chartData,
        loading: loading || (priceData?.loading && chartData.length === 0),
        error: error || priceData?.error,
        refresh,
        getLineChartData: () => ({
            labels: chartData.map((d) => d.x.toLocaleTimeString()),
            datasets: [{
                label: `${tokenSymbol} Price`,
                data: chartData.map((d) => d.y),
                borderColor: '#375bd2',
                backgroundColor: 'rgba(55, 91, 210, 0.1)',
                tension: 0.4,
                fill: true
            }]
        }),
        getCandlestickData: () => {
            const intervals = {};
            chartData.forEach((point) => {
                const timeKey = new Date(point.x).toISOString().slice(0, 16);
                if (!intervals[timeKey]) {
                    intervals[timeKey] = {
                        open: point.y,
                        high: point.y,
                        low: point.y,
                        close: point.y,
                        time: timeKey
                    };
                } else {
                    intervals[timeKey].high = Math.max(intervals[timeKey].high, point.y);
                    intervals[timeKey].low = Math.min(intervals[timeKey].low, point.y);
                    intervals[timeKey].close = point.y;
                }
            });

            return Object.values(intervals);
        },
        stats: {
            current: chartData[chartData.length - 1]?.y || 0,
            high: Math.max(...chartData.map((d) => d.y)),
            low: Math.min(...chartData.map((d) => d.y)),
            change: chartData.length > 1
                ? ((chartData[chartData.length - 1].y - chartData[0].y) / chartData[0].y * 100)
                : 0,
            volume: chartData.length
        }
    };
};

export const usePriceComparison = (tokenSymbol, chain = 'ethereum', sources = ['chainlink', 'binance', 'oneinch']) => {
    const chainlink = useChainlinkPrice(tokenSymbol, chain);

    const [binancePrice, setBinancePrice] = useState(null);
    const [oneInchPrice, setOneInchPrice] = useState(null);

    useEffect(() => {
        if (sources.includes('binance')) {
            const fetchBinance = async () => {
            };
            fetchBinance();
        }
    }, [tokenSymbol, sources]);

    const allPrices = {
        chainlink: chainlink.price,
        binance: binancePrice,
        oneinch: oneInchPrice
    };

    const deviations = {};
    if (chainlink.price && binancePrice) {
        deviations.chainlinkVsBinance = ((chainlink.price - binancePrice) / binancePrice) * 100;
    }

    return {
        prices: allPrices,
        deviations,
        chainlink
    };
};

export default {
    useChainlink,
    useChainlinkPrice,
    useChainlinkBatchPrices,
    useChainlinkChartData,
    usePriceComparison
};
