import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const TokensContext = createContext();

export const useTokens = () => {
    const context = useContext(TokensContext);
    if (!context) {
        throw new Error('useTokens must be used within a TokensProvider');
    }
    return context;
};

export const TokensProvider = ({ children }) => {
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_URL = 'http://localhost:3001/api/tokens';

    // Use useCallback to prevent unnecessary re-renders
    const fetchTokens = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(API_URL);
            setTokens(response.data);
        } catch (err) {
            console.error('Error fetching tokens:', err);
            setError(err.response?.data?.error || 'Failed to load tokens from database');
        } finally {
            setLoading(false);
        }
    }, []);

    const addToken = async (tokenData) => {
        try {
            const response = await axios.post(API_URL, tokenData);
            setTokens(prev => [...prev, response.data]);
            return { success: true, data: response.data };
        } catch (err) {
            console.error('Error adding token:', err);
            return { 
                success: false, 
                error: err.response?.data?.error || 'Failed to add token' 
            };
        }
    };

    const updateToken = async (symbol, tokenData) => {
        try {
            const response = await axios.put(`${API_URL}/${symbol}`, tokenData);
            setTokens(prev => prev.map(t => 
                t.symbol.toLowerCase() === symbol.toLowerCase() ? response.data : t
            ));
            return { success: true, data: response.data };
        } catch (err) {
            console.error('Error updating token:', err);
            return { 
                success: false, 
                error: err.response?.data?.error || 'Failed to update token' 
            };
        }
    };

    const deleteToken = async (symbol) => {
        try {
            await axios.delete(`${API_URL}/${symbol}`);
            setTokens(prev => prev.filter(t => 
                t.symbol.toLowerCase() !== symbol.toLowerCase()
            ));
            return { success: true };
        } catch (err) {
            console.error('Error deleting token:', err);
            return { 
                success: false, 
                error: err.response?.data?.error || 'Failed to delete token' 
            };
        }
    };

    // Optional: Add a refresh function
    const refreshTokens = () => {
        setLoading(true);
        fetchTokens();
    };

    useEffect(() => {
        fetchTokens();
    }, [fetchTokens]);

    return (
        <TokensContext.Provider value={{
            tokens,
            loading,
            error,
            fetchTokens: refreshTokens, // Use refreshTokens as the public function
            addToken,
            updateToken,
            deleteToken,
            // Additional useful values:
            totalTokens: tokens.length,
            tokenSymbols: tokens.map(t => t.symbol)
        }}>
            {children}
        </TokensContext.Provider>
    );
};