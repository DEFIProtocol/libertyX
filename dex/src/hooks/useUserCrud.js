import { useCallback, useState } from 'react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_API_BASE_URL}/users` || 'https://libertyx.onrender.com/api/users';

export const useUserCrud = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const createUser = useCallback(async (payload) => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.post(API_URL, payload);
            return { success: true, data: response.data.data };
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Failed to create user';
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    }, []);

    const getUserById = useCallback(async (id) => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`${API_URL}/${id}`);
            return { success: true, data: response.data.data };
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Failed to fetch user';
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    }, []);

    const getUserByWallet = useCallback(async (walletAddress) => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`${API_URL}/wallet/${walletAddress}`);
            return { success: true, data: response.data.data };
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Failed to fetch user';
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    }, []);

    const updateUserById = useCallback(async (id, payload) => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.put(`${API_URL}/${id}`, payload);
            return { success: true, data: response.data.data };
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Failed to update user';
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    }, []);

    const updateUserByWallet = useCallback(async (walletAddress, payload) => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.put(`${API_URL}/wallet/${walletAddress}`, payload);
            return { success: true, data: response.data.data };
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Failed to update user';
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteUser = useCallback(async (id) => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.delete(`${API_URL}/${id}`);
            return { success: true, data: response.data.data };
        } catch (err) {
            const message = err.response?.data?.error || err.message || 'Failed to delete user';
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        loading,
        error,
        createUser,
        getUserById,
        getUserByWallet,
        updateUserById,
        updateUserByWallet,
        deleteUser,
        clearError
    };
};

export default useUserCrud;
