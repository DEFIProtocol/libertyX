import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useBinanceWs } from './BinanceWsContext';

const GlobalPriceContext = createContext();

export const useGlobalPrices = () => useContext(GlobalPriceContext);

export const GlobalPriceProvider = ({ children }) => {
    const [prices, setPrices] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const didTryRapidRef = useRef(false);

    const { isConnected: wsConnected, latestData } = useBinanceWs();

    const refreshRapidApi = async () => {
        try {
            const response = await fetch('/api/global-prices/refresh-rapidapi', {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                const refreshResponse = await fetch('/api/global-prices/all');
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
                const response = await fetch('/api/global-prices/all');
                const data = await response.json();

                if (data.success) {
                    setPrices(data.prices);
                    setLastUpdated(data.timestamp);

                    const rapidCount = Object.values(data.prices || {}).filter((p) => p.source === 'rapidapi').length;
                    if (rapidCount === 0 && !didTryRapidRef.current) {
                        didTryRapidRef.current = true;
                        await refreshRapidApi();
                        const refreshResponse = await fetch('/api/global-prices/all');
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

    const value = {
        prices,
        isLoading,
        lastUpdated,
        wsConnected,
        getPrice,
        getBatchPrices,
        refreshRapidApi,
        refreshPrices,
        totalPrices: Object.keys(prices).length,
        binancePrices: Object.values(prices).filter((p) => p.source === 'binance').length,
        rapidApiPrices: Object.values(prices).filter((p) => p.source === 'rapidapi').length
    };

    return (
        <GlobalPriceContext.Provider value={value}>
            {children}
        </GlobalPriceContext.Provider>
    );
};

export default GlobalPriceContext;
