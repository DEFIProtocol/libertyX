import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBinanceWs } from './BinanceWsContext';
import { useCoinbaseWsContext } from './CoinbaseWsContext';

const GlobalPriceContext = createContext();

export const useGlobalPrices = () => useContext(GlobalPriceContext);

export const GlobalPriceProvider = ({ children }) => {
    const [prices, setPrices] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const didTryRapidRef = useRef(false);

    const { isConnected: wsConnected, latestData } = useBinanceWs();
    const {
        isConnected: coinbaseConnected,
        latestTicker: coinbaseTicker,
        setSymbols: setCoinbaseSymbols
    } = useCoinbaseWsContext();

    const refreshRapidApi = async () => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/global-prices/refresh-rapidapi`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                const refreshResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/global-prices/all`);
                const refreshData = await refreshResponse.json();

                if (refreshData.success) {
                    setPrices(refreshData.prices);
                    setLastUpdated(refreshData.timestamp);
                }
            }

            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    useEffect(() => {
        const fetchInitialPrices = async () => {
            try {
                setIsLoading(true);
                const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/global-prices/all`);
                const data = await response.json();

                if (data.success) {
                    setPrices(data.prices);
                    setLastUpdated(data.timestamp);

                    const rapidCount = Object.values(data.prices || {}).filter((p) => p.source === 'rapidapi').length;
                    if (rapidCount === 0 && !didTryRapidRef.current) {
                        didTryRapidRef.current = true;
                        await refreshRapidApi();
                        const refreshResponse = await fetch(`${process.env.REACT_APP_API_BASE_URL}/global-prices/all`);
                        const refreshData = await refreshResponse.json();
                        if (refreshData.success) {
                            setPrices(refreshData.prices);
                            setLastUpdated(refreshData.timestamp);
                        }
                    }
                }
            } catch (error) {
                // ignore
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialPrices();

        const interval = setInterval(fetchInitialPrices, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const coinbaseSymbols = useMemo(() => Object.keys(prices || {}), [prices]);
    const coinbaseSymbolsKeyRef = useRef('');

    useEffect(() => {
        if (coinbaseSymbols.length === 0) return;

        const nextKey = coinbaseSymbols.join('|');
        if (nextKey === coinbaseSymbolsKeyRef.current) return;

        coinbaseSymbolsKeyRef.current = nextKey;
        setCoinbaseSymbols(coinbaseSymbols);
    }, [coinbaseSymbols, setCoinbaseSymbols]);

    useEffect(() => {
        if (latestData && Array.isArray(latestData)) {
            setPrices((prev) => {
                const updates = {};

                latestData.forEach((ticker) => {
                    if (ticker.s && ticker.c) {
                        const symbol = ticker.s.replace('USDT', '').toUpperCase();
                        updates[symbol] = {
                            ...prev[symbol],
                            symbol,
                            price: parseFloat(ticker.c),
                            binancePrice: parseFloat(ticker.c),
                            source: 'binance',
                            isLive: true,
                            lastUpdated: Date.now(),
                            rawTicker: ticker,
                            changePercent: parseFloat(ticker.P) || prev[symbol]?.changePercent || 0,
                            volume: parseFloat(ticker.v) || prev[symbol]?.volume || 0,
                            high: parseFloat(ticker.h) || prev[symbol]?.high || 0,
                            low: parseFloat(ticker.l) || prev[symbol]?.low || 0
                        };
                    }
                });

                if (Object.keys(updates).length === 0) {
                    return prev;
                }

                return {
                    ...prev,
                    ...updates
                };
            });
            setLastUpdated(Date.now());
        }
    }, [latestData]);

    useEffect(() => {
        if (!coinbaseTicker?.symbol || !coinbaseTicker?.price) return;

        const symbol = coinbaseTicker.symbol.toUpperCase();
        const price = parseFloat(coinbaseTicker.price);

        if (Number.isNaN(price)) return;

        setPrices((prev) => {
            const existing = prev[symbol] || {};
            const hasBinance = existing.binancePrice !== undefined && existing.binancePrice !== null;
            const next = {
                ...existing,
                symbol,
                coinbasePrice: price,
                coinbaseUpdatedAt: Date.now()
            };

            if (!wsConnected && !hasBinance) {
                next.price = price;
                next.source = 'coinbase';
                next.isLive = true;
                next.lastUpdated = Date.now();
            }

            return {
                ...prev,
                [symbol]: next
            };
        });

        if (!wsConnected) {
            setLastUpdated(Date.now());
        }
    }, [coinbaseTicker, wsConnected]);

    const getPrice = (symbol) => {
        const normalizedSymbol = symbol.toUpperCase();
        return prices[normalizedSymbol] || null;
    };

    const getBatchPrices = (symbols) => {
        const result = {};
        symbols.forEach((symbol) => {
            const price = getPrice(symbol);
            if (price) result[symbol.toUpperCase()] = price;
        });
        return result;
    };

    const refreshPrices = refreshRapidApi;

    const coinbaseTotalPrices = Object.values(prices).filter((p) => p?.coinbasePrice !== undefined && p?.coinbasePrice !== null).length;
    const coinbaseUsedPrices = Object.values(prices).filter((p) => p?.source === 'coinbase').length;

    const value = {
        prices,
        isLoading,
        lastUpdated,
        wsConnected,
        coinbaseConnected,
        getPrice,
        getBatchPrices,
        refreshRapidApi,
        refreshPrices,
        totalPrices: Object.keys(prices).length,
        binancePrices: Object.values(prices).filter((p) => p.source === 'binance').length,
        rapidApiPrices: Object.values(prices).filter((p) => p.source === 'rapidapi').length,
        coinbasePrices: coinbaseUsedPrices,
        coinbaseTotalPrices,
        coinbaseUsedPrices
    };

    return (
        <GlobalPriceContext.Provider value={value}>
            {children}
        </GlobalPriceContext.Provider>
    );
};

export default GlobalPriceContext;
