import React, { createContext, useState } from 'react';
import { mainnet, polygon, arbitrum, bsc, avalanche } from 'wagmi/chains';

const availableChains = [
  { key: 'ethereum', label: 'Ethereum', chain: mainnet },
  { key: 'polygon', label: 'Polygon', chain: polygon },
  { key: 'arbitrum', label: 'Arbitrum', chain: arbitrum },
  { key: 'bsc', label: 'BSC', chain: bsc },
  { key: 'avalanche', label: 'Avalanche', chain: avalanche },
];

const ChainContext = createContext({
  selected: mainnet,
  setSelected: () => {},
  availableChains,
});

export function ChainProvider({ children }) {
  const [selected, setSelected] = useState(mainnet);
  return (
    <ChainContext.Provider value={{ selected, setSelected, availableChains }}>
      {children}
    </ChainContext.Provider>
  );
}

export default ChainContext;
