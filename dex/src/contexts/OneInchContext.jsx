import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const OneInchContext = createContext();

export const useOneInch = () => useContext(OneInchContext);

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://libertyx.onrender.com/api';

export const OneInchProvider = ({ children, defaultChainId = '1' }) => {
  const [chainId, setChainId] = useState(defaultChainId);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTokens = async (nextChainId = chainId) => {
    try {
      setIsLoading(true);
      setError(null);
      console.log(`[OneInchContext] fetching url=${API_BASE_URL}/oneinch/tokens?chainId=${nextChainId}`);
      const response = await fetch(`${API_BASE_URL}/oneinch/tokens?chainId=${nextChainId}`);
      const json = await response.json();

      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to fetch 1inch tokens');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch 1inch tokens');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens(chainId);
  }, [chainId]);

  const tokensMap = useMemo(() => data?.tokens || data || {}, [data]);
  const tokensList = useMemo(() => {
    return Object.entries(tokensMap).map(([address, token]) => ({
      ...token,
      address: token?.address || address
    }));
  }, [tokensMap]);

  const value = {
    data,
    tokensMap,
    tokensList,
    isLoading,
    error,
    chainId,
    setChainId,
    refresh: fetchTokens
  };

  return (
    <OneInchContext.Provider value={value}>
      {children}
    </OneInchContext.Provider>
  );
};

export default OneInchContext;
