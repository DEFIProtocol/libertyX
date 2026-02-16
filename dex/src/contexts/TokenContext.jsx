// TokenContext.jsx - UPDATED for comparison mode
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
    const [dbTokens, setDbTokens] = useState([]);
    const [jsonTokens, setJsonTokens] = useState([]);
    const [loading, setLoading] = useState({ db: true, json: true });
    const [errors, setErrors] = useState({ db: null, json: null });
    const [comparisonData, setComparisonData] = useState([]); // Array of tokens with both sources
    const [comparisonMode, setComparisonMode] = useState(false); // true = show comparison

    const API_URL = process.env.REACT_APP_API_BASE_URL || 'http://libertyx.onrender.com/api/tokens';

    // Fetch database tokens
    const fetchDbTokens = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, db: true }));
            setErrors(prev => ({ ...prev, db: null }));
            
            const response = await axios.get(`${API_URL}/db`);
            const tokens = response.data.data || [];
            setDbTokens(tokens);
            
            console.log(`✅ Loaded ${tokens.length} tokens from database`);
            return tokens;
        } catch (error) {
            console.error('❌ Error fetching database tokens:', error);
            const errorMsg = error.response?.data?.error || 'Failed to load from database';
            setErrors(prev => ({ ...prev, db: errorMsg }));
            setDbTokens([]);
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, db: false }));
        }
    }, []);

    // Fetch JSON tokens
    const fetchJsonTokens = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, json: true }));
            setErrors(prev => ({ ...prev, json: null }));
            
            const response = await axios.get(`${API_URL}/json`);
            const tokens = response.data.data || [];
            setJsonTokens(tokens);
            
            console.log(`📄 Loaded ${tokens.length} tokens from JSON file`);
            return tokens;
        } catch (error) {
            console.error('❌ Error fetching JSON tokens:', error);
            const errorMsg = error.response?.data?.error || 'Failed to load from JSON file';
            setErrors(prev => ({ ...prev, json: errorMsg }));
            setJsonTokens([]);
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, json: false }));
        }
    }, []);

    // Fetch both and create comparison data
    const fetchAllTokens = useCallback(async () => {
        setLoading({ db: true, json: true });
        
        try {
            const [dbResult, jsonResult] = await Promise.allSettled([
                fetchDbTokens(),
                fetchJsonTokens()
            ]);
            
            const dbTokens = dbResult.status === 'fulfilled' ? dbResult.value : [];
            const jsonTokens = jsonResult.status === 'fulfilled' ? jsonResult.value : [];
            
            // Create comparison array - merge tokens from both sources by symbol
            const allSymbols = new Set([
                ...dbTokens.map(t => t.symbol.toLowerCase()),
                ...jsonTokens.map(t => t.symbol.toLowerCase())
            ]);
            
            const comparison = Array.from(allSymbols).map(symbol => {
                const dbToken = dbTokens.find(t => t.symbol.toLowerCase() === symbol);
                const jsonToken = jsonTokens.find(t => t.symbol.toLowerCase() === symbol);
                
                return {
                    symbol: symbol.toUpperCase(),
                    inDatabase: !!dbToken,
                    inJson: !!jsonToken,
                    database: dbToken || null,
                    json: jsonToken || null,
                    match: dbToken && jsonToken ? 
                        JSON.stringify(dbToken) === JSON.stringify(jsonToken) : 
                        false
                };
            });
            
            // Sort by symbols that exist in both, then by symbol
            comparison.sort((a, b) => {
                if (a.inDatabase && a.inJson && !(b.inDatabase && b.inJson)) return -1;
                if (!(a.inDatabase && a.inJson) && b.inDatabase && b.inJson) return 1;
                return a.symbol.localeCompare(b.symbol);
            });
            
            setComparisonData(comparison);
            
            return { dbTokens, jsonTokens, comparison };
        } catch (error) {
            console.error('Error in fetchAllTokens:', error);
            return { dbTokens: [], jsonTokens: [], comparison: [] };
        } finally {
            setLoading({ db: false, json: false });
        }
    }, [fetchDbTokens, fetchJsonTokens]);

    // Toggle comparison mode
    const toggleComparisonMode = () => {
        setComparisonMode(prev => !prev);
    };

    // Get tokens based on current mode
    const getDisplayTokens = () => {
        if (comparisonMode) {
            return comparisonData;
        }
        return dbTokens; // Default to database when not in comparison
    };

    // Get stats for comparison
    const getComparisonStats = () => {
        const onlyInDb = comparisonData.filter(item => item.inDatabase && !item.inJson).length;
        const onlyInJson = comparisonData.filter(item => !item.inDatabase && item.inJson).length;
        const inBoth = comparisonData.filter(item => item.inDatabase && item.inJson).length;
        const matching = comparisonData.filter(item => item.match).length;
        
        return {
            total: comparisonData.length,
            onlyInDb,
            onlyInJson,
            inBoth,
            matching,
            different: inBoth - matching
        };
    };

    // CRUD operations (only work on database)
    const addToken = async (tokenData) => {
        try {
            const response = await axios.post(API_URL, tokenData);
            const newToken = response.data;
            
            // Update database tokens
            setDbTokens(prev => [...prev, newToken]);
            
            // Update comparison data if needed
            if (comparisonMode) {
                await fetchAllTokens();
            }
            
            return { success: true, data: newToken };
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
            const updatedToken = response.data;
            
            // Update database tokens
            setDbTokens(prev => prev.map(t => 
                t.symbol.toLowerCase() === symbol.toLowerCase() ? updatedToken : t
            ));
            
            // Update comparison data if needed
            if (comparisonMode) {
                await fetchAllTokens();
            }
            
            return { success: true, data: updatedToken };
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
            
            // Remove from database tokens
            setDbTokens(prev => prev.filter(t => 
                t.symbol.toLowerCase() !== symbol.toLowerCase()
            ));
            
            // Update comparison data if needed
            if (comparisonMode) {
                await fetchAllTokens();
            }
            
            return { success: true };
        } catch (err) {
            console.error('Error deleting token:', err);
            return { 
                success: false, 
                error: err.response?.data?.error || 'Failed to delete token' 
            };
        }
    };

    // Initial load
    useEffect(() => {
        fetchAllTokens();
    }, [fetchAllTokens]);

    return (
        <TokensContext.Provider value={{
            // Raw data
            dbTokens,
            jsonTokens,
            comparisonData,
            
            // Display data
            displayTokens: getDisplayTokens(),
            comparisonMode,
            
            // Loading states
            loading,
            loadingDb: loading.db,
            loadingJson: loading.json,
            loadingAll: loading.db || loading.json,
            
            // Errors
            errors,
            errorDb: errors.db,
            errorJson: errors.json,
            
            // Actions
            fetchDbTokens,
            fetchJsonTokens,
            fetchAllTokens,
            refreshAll: fetchAllTokens,
            toggleComparisonMode,
            
            // CRUD operations
            addToken,
            updateToken,
            deleteToken,
            
            // Stats
            dbCount: dbTokens.length,
            jsonCount: jsonTokens.length,
            comparisonStats: getComparisonStats(),
            
            // Helpers
            getDisplayTokens,
            getComparisonStats
        }}>
            {children}
        </TokensContext.Provider>
    );
};