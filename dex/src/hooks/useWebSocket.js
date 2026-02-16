import { useEffect, useRef, useState } from 'react';

// Use the same base URL pattern as your API calls
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'https://libertyx.onrender.com';
// Convert https to wss, http to ws
const WS_BASE = API_BASE.replace(/^http/, 'ws');
const DEFAULT_WS_URL = `${WS_BASE}/ws/binance`;

// Allow override via environment variable
const WS_URL = process.env.REACT_APP_BINANCE_WS_URL || DEFAULT_WS_URL;

export const useWebSocket = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [latestData, setLatestData] = useState(null);
    const wsRef = useRef(null);

    useEffect(() => {
        console.log('🔌 Connecting to Binance WebSocket:', WS_URL); // Debug log
        
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('✅ Binance WebSocket connected');
            setIsConnected(true);
        };
        
        ws.onclose = (event) => {
            console.log('❌ Binance WebSocket disconnected', event.code, event.reason);
            setIsConnected(false);
        };
        
        ws.onerror = (error) => {
            console.error('⚠️ Binance WebSocket error:', error);
            setIsConnected(false);
        };

        ws.onmessage = (event) => {
            try {
                const parsed = JSON.parse(event.data);
                setLatestData(parsed);
            } catch (error) {
                // ignore parse errors
            }
        };

        return () => {
            try {
                ws.close();
            } catch (e) {
                // ignore
            }
        };
    }, []);

    return { isConnected, latestData };
};

export default useWebSocket;