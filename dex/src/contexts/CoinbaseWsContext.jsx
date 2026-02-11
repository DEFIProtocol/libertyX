import React, { createContext, useContext, useMemo, useState } from 'react';
import { useCoinbaseWs } from '../hooks/useCoinbaseWs';

const CoinbaseWsContext = createContext({
    isConnected: false,
    latestData: null,
    latestTicker: null,
    activeUrl: null,
    symbols: [],
    setSymbols: () => {}
});

export const useCoinbaseWsContext = () => useContext(CoinbaseWsContext);

export const CoinbaseWsProvider = ({ children, initialSymbols = [] }) => {
    const [symbols, setSymbols] = useState(initialSymbols);
    const { isConnected, latestData, latestTicker, activeUrl } = useCoinbaseWs(symbols);

    const value = useMemo(
        () => ({
            isConnected,
            latestData,
            latestTicker,
            activeUrl,
            symbols,
            setSymbols
        }),
        [isConnected, latestData, latestTicker, activeUrl, symbols]
    );

    return <CoinbaseWsContext.Provider value={value}>{children}</CoinbaseWsContext.Provider>;
};

export default CoinbaseWsContext;
