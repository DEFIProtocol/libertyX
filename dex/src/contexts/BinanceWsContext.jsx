import React, { createContext, useContext } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

const BinanceWsContext = createContext();

export const useBinanceWs = () => useContext(BinanceWsContext);

export const BinanceWsProvider = ({ children }) => {
    const { isConnected, latestData } = useWebSocket();

    return (
        <BinanceWsContext.Provider value={{ isConnected, latestData }}>
            {children}
        </BinanceWsContext.Provider>
    );
};

export default BinanceWsContext;
