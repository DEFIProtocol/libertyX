import { useEffect, useRef, useState } from 'react';

const DEFAULT_WS_URL = (() => {
    if (typeof window === 'undefined') return 'ws://localhost:3001/ws/binance';
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.hostname}:3001/ws/binance`;
})();

const WS_URL = process.env.REACT_APP_BINANCE_WS_URL || DEFAULT_WS_URL;

export const useWebSocket = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [latestData, setLatestData] = useState(null);
    const wsRef = useRef(null);

    useEffect(() => {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
        };
        ws.onclose = () => {
            setIsConnected(false);
        };
        ws.onerror = () => {
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
