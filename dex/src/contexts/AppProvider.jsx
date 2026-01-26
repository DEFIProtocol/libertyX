import { TokensProvider } from './TokenContext';
import { ChainProvider } from './ChainContext';

export function AppProvider({ children }) {
  return (
    <TokensProvider>
      <ChainProvider>
        {children}
      </ChainProvider>
    </TokensProvider>
  );
}