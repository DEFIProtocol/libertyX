import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const RapidApiContext = createContext();

export const useRapidApi = () => useContext(RapidApiContext);

export const RapidApiProvider = ({ children }) => {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCoins = async (limit = 1200) => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/rapidapi/coins?limit=${limit}`);
            const json = await response.json();

            if (json.success) {
                setData(json.data);
            } else {
                setError(json.error || 'Failed to fetch RapidAPI coins');
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch RapidAPI coins');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCoins(1200);
    }, []);

    const coins = useMemo(() => data?.coins || [], [data]);
    const stats = useMemo(() => data?.stats || null, [data]);

    const value = {
        data,
        coins,
        stats,
        isLoading,
        error,
        refresh: fetchCoins
    };

    return (
        <RapidApiContext.Provider value={value}>
            {children}
        </RapidApiContext.Provider>
    );
};

export default RapidApiContext;
