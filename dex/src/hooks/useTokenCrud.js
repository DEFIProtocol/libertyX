import { useCallback, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/tokens';

/**
 * useTokenCrud - Hook for token CRUD operations
 * Provides functions to create, read, update, and delete tokens
 */
export const useTokenCrud = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // CREATE: Add a new token
    const createToken = useCallback(async (tokenData) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.post(API_URL, {
                symbol: tokenData.symbol.toUpperCase(),
                name: tokenData.name,
                price: parseFloat(tokenData.price) || 0,
                market_cap: parseFloat(tokenData.market_cap) || 0,
                volume_24h: parseFloat(tokenData.volume_24h) || 0,
                decimals: parseInt(tokenData.decimals) || 18,
                type: tokenData.type || 'ERC-20'
            });

            return {
                success: true,
                data: response.data,
                message: 'Token created successfully'
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to create token';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    // UPDATE: Update an existing token
    const updateToken = useCallback(async (symbol, tokenData) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.put(`${API_URL}/${symbol}`, {
                name: tokenData.name,
                price: parseFloat(tokenData.price) || 0,
                market_cap: parseFloat(tokenData.market_cap) || 0,
                volume_24h: parseFloat(tokenData.volume_24h) || 0,
                decimals: parseInt(tokenData.decimals) || 18,
                type: tokenData.type || 'ERC-20'
            });

            return {
                success: true,
                data: response.data,
                message: 'Token updated successfully'
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to update token';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    // DELETE: Delete a token
    const deleteToken = useCallback(async (symbol) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.delete(`${API_URL}/${symbol}`);

            return {
                success: true,
                data: response.data,
                message: 'Token deleted successfully'
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to delete token';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    // GET: Fetch single token by symbol
    const getToken = useCallback(async (symbol) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(`${API_URL}/${symbol}`);

            return {
                success: true,
                data: response.data
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to fetch token';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // TOKEN ADDRESS CRUD
    const getTokenAddresses = useCallback(async (symbol) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.get(`${API_URL}/db/${symbol}/addresses`);

            return {
                success: true,
                data: response.data.data
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to fetch token addresses';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    const createTokenAddress = useCallback(async (symbol, { chain, address }) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.post(`${API_URL}/db/${symbol}/addresses`, {
                chain,
                address
            });

            return {
                success: true,
                data: response.data,
                message: 'Token address created successfully'
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to create token address';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    const updateTokenAddress = useCallback(async (symbol, chain, address) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.put(
                `${API_URL}/db/${symbol}/addresses/${encodeURIComponent(chain)}`,
                { address }
            );

            return {
                success: true,
                data: response.data,
                message: 'Token address updated successfully'
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to update token address';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteTokenAddress = useCallback(async (symbol, chain) => {
        try {
            setLoading(true);
            setError(null);

            const response = await axios.delete(
                `${API_URL}/db/${symbol}/addresses/${encodeURIComponent(chain)}`
            );

            return {
                success: true,
                data: response.data,
                message: 'Token address deleted successfully'
            };
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to delete token address';
            setError(errorMsg);
            return {
                success: false,
                error: errorMsg
            };
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        createToken,
        updateToken,
        deleteToken,
        getToken,
        getTokenAddresses,
        createTokenAddress,
        updateTokenAddress,
        deleteTokenAddress,
        loading,
        error,
        clearError
    };
};

export default useTokenCrud;
