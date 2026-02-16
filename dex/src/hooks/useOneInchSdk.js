// dex/hooks/useOneInchSdk.js
import { useCallback, useState } from 'react';
import axios from 'axios';
import { useChainContext } from '../contexts/ChainContext'; // Import your existing ChainContext

const API_BASE_URL = `${process.env.REACT_APP_API_BASE_URL || 'http://libertyx.onrender.com/api'}/fusion`;

// Chain ID to key/name mapping based on your ChainContext
const CHAIN_ID_MAPPING = {
    '1': { key: 'ethereum', name: 'Ethereum' },
    '56': { key: 'bnb', name: 'BNB' },
    '137': { key: 'polygon', name: 'Polygon' },
    '43114': { key: 'avalanche', name: 'Avalanche' },
    '42161': { key: 'arbitrum', name: 'Arbitrum' },
    '501': { key: 'solana', name: 'Solana' }
};

export const useOneInchSdk = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    // Get the chain context
    const { selectedChain } = useChainContext();

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

    // Helper function to map chain ID to backend format
    const mapChainToBackendFormat = useCallback((chainId) => {
        const chainMapping = {
            '1': 'ethereum',      // Ethereum -> ethereum
            '56': 'bsc',          // BNB -> bsc (Infura uses 'bsc' for BSC)
            '137': 'polygon',     // Polygon -> polygon
            '43114': 'avalanche', // Avalanche -> avalanche
            '42161': 'arbitrum',  // Arbitrum -> arbitrum
            '501': 'solana'       // Solana -> solana (handled separately)
        };
        
        return chainMapping[chainId] || 'ethereum';
    }, []);

    // EVM methods - automatically use selectedChain
    const getEvmQuote = useCallback((payload) => run(async () => {
        const chainKey = mapChainToBackendFormat(selectedChain);
        
        const requestPayload = {
            ...payload,
            networkId: selectedChain,
            chain: chainKey
        };
        
        console.log('EVMM quote request with chain:', {
            selectedChain,
            chainKey,
            payload: requestPayload
        });
        
        const response = await axios.post(`${API_BASE_URL}/evm/quote`, requestPayload);
        return response.data;
    }), [run, selectedChain, mapChainToBackendFormat]);

    const submitEvmOrder = useCallback((payload) => run(async () => {
        const chainKey = mapChainToBackendFormat(selectedChain);
        
        const requestPayload = {
            ...payload,
            networkId: selectedChain,
            chain: chainKey
        };
        
        console.log('EVM submit request with chain:', {
            selectedChain,
            chainKey,
            payload: requestPayload
        });
        
        const response = await axios.post(`${API_BASE_URL}/evm/submit`, requestPayload);
        return response.data;
    }), [run, selectedChain, mapChainToBackendFormat]);

    const getEvmStatus = useCallback((payload) => run(async () => {
        const chainKey = mapChainToBackendFormat(selectedChain);
        
        const requestPayload = {
            ...payload,
            networkId: selectedChain,
            chain: chainKey
        };
        
        const response = await axios.post(`${API_BASE_URL}/evm/status`, requestPayload);
        return response.data;
    }), [run, selectedChain, mapChainToBackendFormat]);

    // Solana method - check if chain is Solana
    const getSolanaQuote = useCallback((payload) => run(async () => {
        if (selectedChain !== '501') {
            throw new Error('Solana operations require Solana chain to be selected');
        }
        
        const response = await axios.post(`${API_BASE_URL}/solana/quote`, payload);
        return response.data;
    }), [run, selectedChain]);

    const submitSolanaOrder = useCallback((payload) => run(async () => {
        if (selectedChain !== '501') {
            throw new Error('Solana operations require Solana chain to be selected');
        }
        
        const response = await axios.post(`${API_BASE_URL}/solana/submit`, payload);
        return response.data;
    }), [run, selectedChain]);

    const getSolanaStatus = useCallback((payload) => run(async () => {
        const response = await axios.post(`${API_BASE_URL}/solana/status`, payload);
        return response.data;
    }), [run]);

    // Helper to get RPC info for debugging
    const getRpcInfo = useCallback(() => run(async () => {
        const chainKey = mapChainToBackendFormat(selectedChain);
        const response = await axios.get(`${API_BASE_URL}/evm/rpc-info/${chainKey}`);
        return response.data;
    }), [run, selectedChain, mapChainToBackendFormat]);

    const clearError = useCallback(() => setError(null), []);

    // Helper to check if current chain is EVM
    const isEVMChain = useCallback(() => {
        return selectedChain !== '501'; // 501 is Solana
    }, [selectedChain]);

    return {
        loading,
        error,
        clearError,
        selectedChain,
        isEVMChain,
        getRpcInfo,
        // EVM methods
        getEvmQuote,
        submitEvmOrder,
        getEvmStatus,
        // Solana methods
        getSolanaQuote,
        submitSolanaOrder,
        getSolanaStatus
    };
};