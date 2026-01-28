import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api/rapidapi';

/**
 * useGetCryptosQuery - Get all coins with optional limit
 * Matches the Redux RTK Query pattern from previous implementation
 * Auto-fetches on mount and provides refetch capability
 */
export const useGetCryptosQuery = (count = 1200) => {
    const [data, setData] = useState(null);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState(null);

    const fetchCryptos = useCallback(async () => {
        try {
            setIsFetching(true);
            setError(null);
            
            const response = await axios.get(`${API_BASE_URL}/coins`, {
                params: { limit: count }
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
            setIsFetching(false);
        }
    }, [count]);

    useEffect(() => {
        fetchCryptos();
    }, [fetchCryptos]);

    return { 
        data, 
        isFetching, 
        error,
        refetch: fetchCryptos
    };
};

/**
 * useGetCryptoDetailsQuery - Get specific coin details
 * Matches the Redux RTK Query pattern from previous implementation
 * Auto-fetches when coinId changes
 */
export const useGetCryptoDetailsQuery = (coinId) => {
    const [data, setData] = useState(null);
    const [isFetching, setIsFetching] = useState(!!coinId);
    const [error, setError] = useState(null);

    const fetchCryptoDetails = useCallback(async (id) => {
        if (!id) {
            setData(null);
            setIsFetching(false);
            return;
        }

        try {
            setIsFetching(true);
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
            setIsFetching(false);
        }
    }, []);

    useEffect(() => {
        fetchCryptoDetails(coinId);
    }, [coinId, fetchCryptoDetails]);

    return { 
        data, 
        isFetching, 
        error,
        refetch: fetchCryptoDetails
    };
};

/**
 * useGetCryptoHistoryQuery - Get coin price history for a time period
 * Matches the Redux RTK Query pattern from previous implementation
 * Auto-fetches when coinId or timePeriod changes
 */
export const useGetCryptoHistoryQuery = (coinId, timePeriod = '24h') => {
    const [data, setData] = useState(null);
    const [isFetching, setIsFetching] = useState(!!coinId);
    const [error, setError] = useState(null);

    const fetchCryptoHistory = useCallback(async (id, period) => {
        if (!id) {
            setData(null);
            setIsFetching(false);
            return;
        }

        try {
            setIsFetching(true);
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
            setIsFetching(false);
        }
    }, []);

    useEffect(() => {
        fetchCryptoHistory(coinId, timePeriod);
    }, [coinId, timePeriod, fetchCryptoHistory]);

    return { 
        data, 
        isFetching, 
        error,
        refetch: fetchCryptoHistory
    };
};


// Optional: Search coins hook - manual trigger for search queries
export const useSearchCoinsQuery = () => {
    const [data, setData] = useState(null);
    const [isFetching, setIsFetching] = useState(false);
    const [error, setError] = useState(null);

    const searchCoins = useCallback(async (query, limit = 50) => {
        if (!query || query.length < 2) {
            setData(null);
            return;
        }

        try {
            setIsFetching(true);
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
            setIsFetching(false);
        }
    }, []);

    return { data, isFetching, error, search: searchCoins };
};