// src/hooks/useLivePrice.js - FIXED VERSION
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Fetch price via REST (for initial load)
const fetchPrice = async (symbol) => {
    const response = await fetch(`http://localhost:3001/api/pricing/price/${symbol}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch price for ${symbol}`);
    }
    return response.json();
};

// Hook for single symbol - FIXED
export const useLivePrice = (symbol, options = {}) => {
    const { enabled = true, refetchInterval = 30000 } = options;
    const [streamingPrice, setStreamingPrice] = useState(null);
    const [streamingSource, setStreamingSource] = useState(null);
    
    // React Query for REST data
    const {
        data: priceData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['price', symbol],
        queryFn: () => fetchPrice(symbol),
        enabled: enabled && !!symbol,
        refetchInterval,
        staleTime: 10000,
    });
    
    // SSE for real-time updates - FIXED with proper cleanup
    useEffect(() => {
        if (!symbol || !enabled) return;
        
        const normalizedSymbol = symbol.toUpperCase();
        
        // Check if SSE endpoint exists first
        const eventSource = new EventSource(
            `http://localhost:3001/api/pricing/stream/${normalizedSymbol}`
        );
        
        const handleMessage = (event) => {
            try {
                // Handle keepalive messages
                if (event.data === ': keepalive') return;
                
                const data = JSON.parse(event.data);
                if (data.type === 'price' && data.symbol === normalizedSymbol) {
                    setStreamingPrice(data.price);
                    setStreamingSource(data.source);
                }
            } catch (error) {
                console.error('SSE parse error:', error);
            }
        };
        
        const handleError = (error) => {
            console.error('SSE error for', normalizedSymbol, ':', error);
            // Don't close on error - let it try to reconnect
        };
        
        eventSource.addEventListener('message', handleMessage);
        eventSource.addEventListener('error', handleError);
        
        return () => {
            eventSource.removeEventListener('message', handleMessage);
            eventSource.removeEventListener('error', handleError);
            eventSource.close();
        };
    }, [symbol, enabled]);
    
    // Use streaming price if available, otherwise use REST price
    const currentPrice = streamingPrice !== null ? streamingPrice : priceData?.price;
    const currentSource = streamingSource !== null ? streamingSource : priceData?.source;
    
    return {
        price: currentPrice,
        source: currentSource,
        isLoading: isLoading && streamingPrice === null,
        error,
        refetch,
        isStreaming: streamingPrice !== null
    };
};

// Hook for multiple symbols (BATCH) - FIXED
export const useLivePrices = (symbols = [], options = {}) => {
    const { enabled = true } = options;
    const [streamingPrices, setStreamingPrices] = useState({});
    
    // React Query for initial batch
    const {
        data: batchData,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['prices', symbols.sort().join(',')],
        queryFn: async () => {
            const response = await fetch('http://localhost:3001/api/pricing/prices/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch batch prices');
            }
            return response.json();
        },
        enabled: enabled && symbols.length > 0,
        staleTime: 10000,
    });
    
    // Single SSE connection for ALL symbols - FIXED
    useEffect(() => {
        if (symbols.length === 0 || !enabled) return;
        
        const normalizedSymbols = symbols.map(s => s.toUpperCase());
        const symbolKey = normalizedSymbols.join(',');
        
        // Create SSE connection
        const eventSource = new EventSource(
            `http://localhost:3001/api/pricing/stream/${symbolKey}`
        );
        
        const handleMessage = (event) => {
            try {
                // Handle keepalive
                if (event.data === ': keepalive') return;
                
                const data = JSON.parse(event.data);
                if (data.type === 'price' && normalizedSymbols.includes(data.symbol)) {
                    setStreamingPrices(prev => ({
                        ...prev,
                        [data.symbol]: {
                            price: data.price,
                            source: data.source,
                            timestamp: data.timestamp
                        }
                    }));
                }
            } catch (error) {
                console.error('Batch SSE parse error:', error);
            }
        };
        
        eventSource.addEventListener('message', handleMessage);
        
        return () => {
            eventSource.removeEventListener('message', handleMessage);
            eventSource.close();
            setStreamingPrices({});
        };
    }, [symbols.join(','), enabled]);
    
    // Merge streaming prices with REST prices
    const mergedPrices = symbols.reduce((acc, symbol) => {
        const normalizedSymbol = symbol.toUpperCase();
        const streamingPrice = streamingPrices[normalizedSymbol];
        
        if (streamingPrice) {
            acc[normalizedSymbol] = streamingPrice;
        } else if (batchData?.prices?.[normalizedSymbol]) {
            acc[normalizedSymbol] = batchData.prices[normalizedSymbol];
        } else if (batchData?.prices) {
            // Check with different case
            const lowerKey = Object.keys(batchData.prices).find(
                key => key.toUpperCase() === normalizedSymbol
            );
            if (lowerKey) {
                acc[normalizedSymbol] = batchData.prices[lowerKey];
            }
        }
        
        return acc;
    }, {});
    
    return {
        prices: mergedPrices,
        isLoading: isLoading && Object.keys(streamingPrices).length === 0,
        error,
        refetch,
        streamingCount: Object.keys(streamingPrices).length,
        totalRequested: symbols.length,
        found: Object.keys(mergedPrices).length
    };
};

// Simple hook for ALL tokens from database - FIXED (no SSE for now)
export const useAllTokenPrices = (options = {}) => {
    const { enabled = true, refetchInterval = 60000 } = options;
    
    const {
        data,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['allTokenPrices'],
        queryFn: async () => {
            const response = await fetch('http://localhost:3001/api/pricing/tokens/prices/detailed');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch all token prices');
            }
            return response.json();
        },
        enabled,
        staleTime: 30000,
        refetchInterval,
    });
    
    return {
        tokens: data?.tokens || [],
        stats: data?.stats,
        isLoading,
        error,
        refetch,
        lastUpdated: data?.timestamp
    };
};

// Simple usage component example
export const PriceDisplay = ({ symbol }) => {
    const { price, isLoading, error, isStreaming } = useLivePrice(symbol);
    
    if (isLoading) return <div>Loading {symbol}...</div>;
    if (error) return <div>Error: {error.message}</div>;
    
    return (
        <div className={`price-display ${isStreaming ? 'streaming' : ''}`}>
            <span className="symbol">{symbol}:</span>
            <span className="price">${price?.toFixed(2) || 'N/A'}</span>
            {isStreaming && <span className="live-badge">● LIVE</span>}
        </div>
    );
};