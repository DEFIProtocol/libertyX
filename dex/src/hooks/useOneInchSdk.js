import { useCallback, useState } from 'react';
import axios from 'axios';

const API_BASE_URL = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api'}/fusion`;

export const useOneInchSdk = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const run = useCallback(async (fn) => {
        try {
            setLoading(true);
            setError(null);
            return await fn();
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Request failed';
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    }, []);

    const getEvmQuote = useCallback((payload) => run(async () => {
        const response = await axios.post(`${API_BASE_URL}/evm/quote`, payload);
        return response.data;
    }), [run]);

    const submitEvmOrder = useCallback((payload) => run(async () => {
        const response = await axios.post(`${API_BASE_URL}/evm/submit`, payload);
        return response.data;
    }), [run]);

    const getEvmStatus = useCallback((payload) => run(async () => {
        const response = await axios.post(`${API_BASE_URL}/evm/status`, payload);
        return response.data;
    }), [run]);

    const getSolanaQuote = useCallback((payload) => run(async () => {
        const response = await axios.post(`${API_BASE_URL}/solana/quote`, payload);
        return response.data;
    }), [run]);

    const submitSolanaOrder = useCallback((payload) => run(async () => {
        const response = await axios.post(`${API_BASE_URL}/solana/submit`, payload);
        return response.data;
    }), [run]);

    const getSolanaStatus = useCallback((payload) => run(async () => {
        const response = await axios.post(`${API_BASE_URL}/solana/status`, payload);
        return response.data;
    }), [run]);

    const clearError = useCallback(() => setError(null), []);

    return {
        loading,
        error,
        clearError,
        getEvmQuote,
        submitEvmOrder,
        getEvmStatus,
        getSolanaQuote,
        submitSolanaOrder,
        getSolanaStatus
    };
};
