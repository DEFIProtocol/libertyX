import { useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_PROXY_WS_URL = (() => {
    if (typeof window === 'undefined') return 'ws://localhost:3001/ws/coinbase';
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${window.location.hostname}:3001/ws/coinbase`;
})();

const COINBASE_WS_PRIMARY =
    process.env.REACT_APP_COINBASE_WS_URL ||
    process.env.REACT_APP_COINBASE_WS_PRIMARY ||
    DEFAULT_PROXY_WS_URL;
const COINBASE_WS_FALLBACK =
    process.env.REACT_APP_COINBASE_WS_FALLBACK || 'wss://ws-feed.exchange.coinbase.com';

const normalizeSymbol = (symbol = '') => {
    return symbol
        .toString()
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
};

const buildProductId = (symbol) => `${normalizeSymbol(symbol)}-USD`;

const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

export const useCoinbaseWs = (symbols = []) => {
    const [isConnected, setIsConnected] = useState(false);
    const [latestData, setLatestData] = useState(null);
    const [latestTicker, setLatestTicker] = useState(null);
    const [activeUrl, setActiveUrl] = useState(null);

    const wsRef = useRef(null);
    const activeUrlRef = useRef(null);
    const subscribedRef = useRef(new Set());
    const shouldReconnectRef = useRef(true);
    const productIdsRef = useRef([]);

    const productIds = useMemo(() => {
        const normalized = symbols
            .map(buildProductId)
            .filter((id) => id && id !== 'USD-USD');

        return Array.from(new Set(normalized));
    }, [symbols]);

    useEffect(() => {
        productIdsRef.current = productIds;
    }, [productIds]);

    const subscribeToProductIds = (ids) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const newIds = ids.filter((id) => !subscribedRef.current.has(id));
        if (newIds.length === 0) return;

        chunkArray(newIds, 100).forEach((batch) => {
            ws.send(
                JSON.stringify({
                    type: 'subscribe',
                    product_ids: batch,
                    channels: ['ticker']
                })
            );
        });

        newIds.forEach((id) => subscribedRef.current.add(id));
    };

    const connect = (url) => {
        if (!url) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;
        activeUrlRef.current = url;
        setActiveUrl(url);
        subscribedRef.current = new Set();

        ws.onopen = () => {
            setIsConnected(true);
            subscribeToProductIds(productIdsRef.current);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                setLatestData(message);

                if (message?.type === 'ticker' && message?.product_id && message?.price) {
                    const symbol = message.product_id.replace('-USD', '').toUpperCase();
                    const price = parseFloat(message.price);

                    if (!Number.isNaN(price)) {
                        setLatestTicker({ symbol, price, raw: message });
                    }
                }
            } catch (error) {
                // ignore parse errors
            }
        };

        ws.onclose = () => {
            setIsConnected(false);

            if (!shouldReconnectRef.current || productIdsRef.current.length === 0) {
                return;
            }

            const nextUrl =
                activeUrlRef.current === COINBASE_WS_PRIMARY
                    ? COINBASE_WS_FALLBACK
                    : COINBASE_WS_PRIMARY;

            setTimeout(() => {
                if (shouldReconnectRef.current) {
                    connect(nextUrl);
                }
            }, 3000);
        };

        ws.onerror = () => {
            setIsConnected(false);
            try {
                ws.close();
            } catch (error) {
                // ignore
            }
        };
    };

    useEffect(() => {
        if (productIds.length === 0) {
            if (wsRef.current) {
                shouldReconnectRef.current = false;
                try {
                    wsRef.current.close();
                } catch (error) {
                    // ignore
                }
            }
            return;
        }

        shouldReconnectRef.current = true;

        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connect(activeUrlRef.current || COINBASE_WS_PRIMARY);
        } else {
            subscribeToProductIds(productIds);
        }

        return () => {
            shouldReconnectRef.current = false;
            if (wsRef.current) {
                try {
                    wsRef.current.close();
                } catch (error) {
                    // ignore
                }
            }
        };
    }, [productIds]);

    return {
        isConnected,
        latestData,
        latestTicker,
        activeUrl
    };
};

export default useCoinbaseWs;
