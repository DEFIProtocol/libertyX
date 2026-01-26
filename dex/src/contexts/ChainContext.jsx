import { createContext, useContext, useState, useEffect } from 'react';

// Create context
const ChainContext = createContext();

// Provider component
export function ChainProvider({ children }) {
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [availableChains, setAvailableChains] = useState([
    'ethereum',
    'polygon', 
    'arbitrum',
    'bsc',
    'avalanche'
  ]);

  // You could fetch chains from API too
  useEffect(() => {
    // Example: Fetch supported chains from API
    // fetch('/api/chains').then(res => res.json()).then(setAvailableChains);
  }, []);

  const value = {
    selectedChain,
    setSelectedChain,
    availableChains,
    setAvailableChains,
    // Helper function
    isChainSupported: (chain) => availableChains.includes(chain.toLowerCase())
  };

  return (
    <ChainContext.Provider value={value}>
      {children}
    </ChainContext.Provider>
  );
}

// Custom hook
export function useChainContext() {
  const context = useContext(ChainContext);
  if (!context) {
    throw new Error('useChainContext must be used within ChainProvider');
  }
  return context;
}