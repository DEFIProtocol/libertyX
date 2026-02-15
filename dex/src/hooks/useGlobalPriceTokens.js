import { useCallback, useEffect, useState } from 'react';

export const useGlobalPriceTokens = () => {
    const [tokens, setTokens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTokens = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/global-prices/tokens`);
            const data = await response.json();

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || 'Failed to load tokens');
            }

            setTokens(data.tokens || []);
            return data;
        } catch (err) {
            setTokens([]);
            setError(err.message);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTokens();
    }, [fetchTokens]);

    return {
        tokens,
        loading,
        error,
        refresh: fetchTokens
    };
};

export default useGlobalPriceTokens;
