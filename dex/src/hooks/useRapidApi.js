import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api/rapidapi';

// Hook 1: Get all coins with limit
export const useGetCryptos = (limit = 1200) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCryptos = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await axios.get(`${API_BASE_URL}/coins`, {
                params: { limit }
            });
            
            if (response.data.success) {
                setData(response.data);
            } else {
                setError(response.data.error || 'Failed to fetch cryptos');
            }
        } catch (err) {
            console.error('Error fetching cryptos:', err);
            setError(err.response?.data?.error || err.message || 'Failed to fetch cryptos');
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchCryptos();
    }, [fetchCryptos]);

    // Manual refresh function
    const refresh = useCallback(() => {
        fetchCryptos();
    }, [fetchCryptos]);

    return { data, loading, error, refresh };
};

// Hook 2: Get specific coin details
export const useGetCryptoDetails = (coinId) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchCryptoDetails = useCallback(async (id) => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);
            
            const response = await axios.get(`${API_BASE_URL}/coin/${id}`);
            
            if (response.data.success) {
                setData(response.data);
            } else {
                setError(response.data.error || 'Failed to fetch crypto details');
            }
        } catch (err) {
            console.error('Error fetching crypto details:', err);
            setError(err.response?.data?.error || err.message || 'Failed to fetch crypto details');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (coinId) {
            fetchCryptoDetails(coinId);
        } else {
            setData(null);
            setError(null);
        }
    }, [coinId, fetchCryptoDetails]);

    // Manual refresh function
    const refresh = useCallback(() => {
        if (coinId) fetchCryptoDetails(coinId);
    }, [coinId, fetchCryptoDetails]);

    return { data, loading, error, refresh };
};

// Hook 3: Get coin history with time period
export const useGetCryptoHistory = (coinId, timePeriod = '24h') => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchCryptoHistory = useCallback(async (id, period) => {
        if (!id) return;

        try {
            setLoading(true);
            setError(null);
            
            const response = await axios.get(`${API_BASE_URL}/coin/${id}/history`, {
                params: { timePeriod: period }
            });
            
            if (response.data.success) {
                setData(response.data);
            } else {
                setError(response.data.error || 'Failed to fetch crypto history');
            }
        } catch (err) {
            console.error('Error fetching crypto history:', err);
            setError(err.response?.data?.error || err.message || 'Failed to fetch crypto history');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (coinId) {
            fetchCryptoHistory(coinId, timePeriod);
        } else {
            setData(null);
            setError(null);
        }
    }, [coinId, timePeriod, fetchCryptoHistory]);

    // Manual refresh function
    const refresh = useCallback(() => {
        if (coinId) fetchCryptoHistory(coinId, timePeriod);
    }, [coinId, timePeriod, fetchCryptoHistory]);

    return { data, loading, error, refresh };
};

// Optional: Search coins hook
export const useSearchCoins = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const searchCoins = useCallback(async (query, limit = 50) => {
        if (!query || query.length < 2) {
            setData(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            
            const response = await axios.get(`${API_BASE_URL}/search`, {
                params: { query, limit }
            });
            
            if (response.data.success) {
                setData(response.data);
            } else {
                setError(response.data.error || 'Failed to search coins');
            }
        } catch (err) {
            console.error('Error searching coins:', err);
            setError(err.response?.data?.error || err.message || 'Failed to search coins');
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, search: searchCoins };
};

// Combined hook for getting everything for a specific coin
export const useGetCryptoFullData = (coinId) => {
    const [fullData, setFullData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { data: details, loading: detailsLoading, error: detailsError } = useGetCryptoDetails(coinId);
    const { data: history24h, loading: historyLoading, error: historyError } = useGetCryptoHistory(coinId, '24h');

    useEffect(() => {
        if (coinId) {
            setLoading(detailsLoading || historyLoading);
            
            if (detailsError || historyError) {
                setError(detailsError || historyError);
            } else if (details && history24h) {
                setFullData({
                    details: details.data,
                    history24h: history24h.data,
                    metadata: {
                        coinId,
                        timestamp: new Date().toISOString()
                    }
                });
                setError(null);
            }
        } else {
            setFullData(null);
            setError(null);
            setLoading(false);
        }
    }, [coinId, details, detailsLoading, detailsError, history24h, historyLoading, historyError]);

    return { data: fullData, loading, error };
};

// Hook for getting multiple coin details at once (batch)
export const useGetMultipleCryptoDetails = (coinIds) => {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchMultipleDetails = useCallback(async (ids) => {
        if (!ids || ids.length === 0) return;

        try {
            setLoading(true);
            setError(null);
            
            const results = {};
            
            // Fetch each coin in parallel
            await Promise.all(
                ids.map(async (coinId) => {
                    try {
                        const response = await axios.get(`${API_BASE_URL}/coin/${coinId}`);
                        if (response.data.success) {
                            results[coinId] = response.data;
                        }
                    } catch (err) {
                        console.error(`Error fetching coin ${coinId}:`, err);
                        results[coinId] = { error: err.message };
                    }
                })
            );
            
            setData(results);
        } catch (err) {
            console.error('Error fetching multiple crypto details:', err);
            setError(err.message || 'Failed to fetch crypto details');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (coinIds && coinIds.length > 0) {
            fetchMultipleDetails(coinIds);
        } else {
            setData({});
        }
    }, [JSON.stringify(coinIds), fetchMultipleDetails]);

    const refresh = useCallback(() => {
        if (coinIds && coinIds.length > 0) {
            fetchMultipleDetails(coinIds);
        }
    }, [coinIds, fetchMultipleDetails]);

    return { data, loading, error, refresh };
};