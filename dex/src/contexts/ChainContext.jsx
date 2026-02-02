import { createContext, useContext, useState, useEffect } from 'react';

// Create context
const ChainContext = createContext();

// Provider component
export function ChainProvider({ children }) {
  const [selectedChain, setSelectedChain] = useState('1');
  const [availableChains, setAvailableChains] = useState([
    { id: '1', label: 'Ethereum', key: 'ethereum' },
    { id: '56', label: 'BNB', key: 'bnb' },
    { id: '137', label: 'Polygon (PoS)', key: 'polygon' },
    { id: '43114', label: 'Avalanche', key: 'avalanche' },
    { id: '42161', label: 'Arbitrum', key: 'arbitrum' },
    { id: '501', label: 'Solana', key: 'solana' }
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
    isChainSupported: (chainId) => availableChains.some((chain) => chain.id === String(chainId)),
    getChainLabel: (chainId) => availableChains.find((chain) => chain.id === String(chainId))?.label
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