// contexts/UserContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import axios from 'axios';
import { useUserCrud } from '../hooks/useUserCrud';

const UserContext = createContext();

// Fix: Split the base URL and API path
const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://libertyx.onrender.com';
const USERS_API_URL = `${API_BASE}/api/users`; // This will be the base for all user routes

const normalizeWatchlist = (raw) => {
    if (!raw) return [];
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return Array.isArray(raw) ? raw : [];
};

const extractTokenKey = (token) => {
    if (!token) return '';
    if (typeof token === 'string') return token;
    return token.uuid || token.id || token.symbol || '';
};

export const useUserContext = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUserContext must be used within a UserProvider');
    }
    return context;
};

export const UserProvider = ({ children }) => {
    const { address } = useAccount();
    const {
        loading: apiLoading,
        error: apiError,
        createUser,
        getUserById,
        getUserByWallet,
        updateUserById,
        updateUserByWallet,
        deleteUser,
        clearError
    } = useUserCrud();

    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [cached, setCached] = useState(false);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [watchlist, setWatchlist] = useState([]);

    const fetchAllUsers = useCallback(async () => {
        setLoading(true);
        try {
            console.log('Fetching all users from:', USERS_API_URL); // Debug log
            const response = await axios.get(USERS_API_URL);
            setUsers(response.data.data || []);
            setCached(true);
        } catch (err) {
            console.error('Failed to fetch users:', err);
            console.error('Error details:', err.response || err.message); // Debug log
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllUsers();
    }, [fetchAllUsers]);

    const loadCurrentUser = useCallback(async (walletAddress) => {
        if (!walletAddress) {
            setCurrentUser(null);
            setWatchlist([]);
            return { success: false, error: 'No wallet address' };
        }

        console.log('Loading user by wallet:', `${USERS_API_URL}/wallet/${walletAddress}`); // Debug log
        const result = await getUserByWallet(walletAddress);
        if (result.success) {
            const nextUser = result.data || null;
            setCurrentUser(nextUser);
            setWatchlist(normalizeWatchlist(nextUser?.watchlist));
        }
        return result;
    }, [getUserByWallet]);

    useEffect(() => {
        if (!address) {
            setCurrentUser(null);
            setWatchlist([]);
            return;
        }

        loadCurrentUser(address);
    }, [address, loadCurrentUser]);

    const addUser = useCallback(async (userData) => {
        console.log('Adding user to:', USERS_API_URL); // Debug log
        const result = await createUser(userData);
        if (result.success) {
            setUsers(prev => [result.data, ...prev]);
            await fetchAllUsers();
        }
        return result;
    }, [createUser, fetchAllUsers]);

    const editUser = useCallback(async (id, userData) => {
        console.log('Editing user at:', `${USERS_API_URL}/${id}`); // Debug log
        const result = await updateUserById(id, userData);
        if (result.success) {
            setUsers(prev => prev.map(user =>
                user.id === id ? result.data : user
            ));
            if (selectedUser?.id === id) {
                setSelectedUser(result.data);
            }
            if (currentUser?.id === id) {
                setCurrentUser(result.data);
                setWatchlist(normalizeWatchlist(result.data?.watchlist));
            }
        }
        return result;
    }, [updateUserById, selectedUser, currentUser]);

    const removeUser = useCallback(async (id) => {
        console.log('Deleting user at:', `${USERS_API_URL}/${id}`); // Debug log
        const result = await deleteUser(id);
        if (result.success) {
            setUsers(prev => prev.filter(user => user.id !== id));
            if (selectedUser?.id === id) {
                setSelectedUser(null);
            }
            if (currentUser?.id === id) {
                setCurrentUser(null);
                setWatchlist([]);
            }
        }
        return result;
    }, [deleteUser, selectedUser, currentUser]);

    const refreshUsers = useCallback(async () => {
        await fetchAllUsers();
    }, [fetchAllUsers]);

    const refreshCurrentUser = useCallback(async () => {
        if (!address) return { success: false, error: 'No wallet address' };
        return loadCurrentUser(address);
    }, [address, loadCurrentUser]);

    const isInWatchlist = useCallback((token) => {
        const tokenKey = extractTokenKey(token);
        if (!tokenKey) return false;
        return watchlist.includes(tokenKey);
    }, [watchlist]);

    const applyOptimisticWatchlist = useCallback((nextWatchlist) => {
        setWatchlist(nextWatchlist);
        setCurrentUser((prev) => (prev ? { ...prev, watchlist: nextWatchlist } : prev));
    }, []);

    const addToWatchlist = useCallback(async (token) => {
        const tokenKey = extractTokenKey(token);
        if (!tokenKey) return { success: false, error: 'Invalid token' };
        if (!currentUser?.id) return { success: false, error: 'User not loaded' };
        if (watchlist.includes(tokenKey)) return { success: true, data: currentUser };

        const previous = watchlist;
        const nextWatchlist = Array.from(new Set([...watchlist, tokenKey]));
        applyOptimisticWatchlist(nextWatchlist);

        console.log('Updating watchlist for user:', `${USERS_API_URL}/${currentUser.id}`); // Debug log
        const result = await updateUserById(currentUser.id, { watchlist: nextWatchlist });
        if (result.success) {
            setCurrentUser(result.data);
            setWatchlist(normalizeWatchlist(result.data?.watchlist));
        } else {
            applyOptimisticWatchlist(previous);
        }
        return result;
    }, [applyOptimisticWatchlist, currentUser, watchlist, updateUserById]);

    const removeFromWatchlist = useCallback(async (token) => {
        const tokenKey = extractTokenKey(token);
        if (!tokenKey) return { success: false, error: 'Invalid token' };
        if (!currentUser?.id) return { success: false, error: 'User not loaded' };
        if (!watchlist.includes(tokenKey)) return { success: true, data: currentUser };

        const previous = watchlist;
        const nextWatchlist = watchlist.filter((item) => item !== tokenKey);
        applyOptimisticWatchlist(nextWatchlist);

        console.log('Updating watchlist for user:', `${USERS_API_URL}/${currentUser.id}`); // Debug log
        const result = await updateUserById(currentUser.id, { watchlist: nextWatchlist });
        if (result.success) {
            setCurrentUser(result.data);
            setWatchlist(normalizeWatchlist(result.data?.watchlist));
        } else {
            applyOptimisticWatchlist(previous);
        }
        return result;
    }, [applyOptimisticWatchlist, currentUser, watchlist, updateUserById]);

    const toggleWatchlistToken = useCallback(async (token) => {
        if (isInWatchlist(token)) {
            return removeFromWatchlist(token);
        }
        return addToWatchlist(token);
    }, [isInWatchlist, addToWatchlist, removeFromWatchlist]);

    const value = {
        users,
        selectedUser,
        currentUser,
        watchlist,
        loading: apiLoading || loading,
        error: apiError,
        cached,
        addUser,
        editUser,
        removeUser,
        refreshUsers,
        refreshCurrentUser,
        setSelectedUser,
        loadCurrentUser,
        isInWatchlist,
        addToWatchlist,
        removeFromWatchlist,
        toggleWatchlistToken,
        getUserById,
        getUserByWallet,
        updateUserByWallet,
        clearError,
        api: {
            createUser,
            updateUserById,
            updateUserByWallet,
            deleteUser,
            getUserById,
            getUserByWallet,
            refreshUsers
        }
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};