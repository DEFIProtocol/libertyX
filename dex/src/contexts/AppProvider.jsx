import { TokensProvider } from './TokenContext';
import { ChainProvider } from './ChainContext';
import { RapidApiProvider } from './RapidApiContext';
import { BinanceWsProvider } from './BinanceWsContext';

export function AppProvider({ children }) {
  return (
    <TokensProvider>
      <BinanceWsProvider>
        <RapidApiProvider>
          <ChainProvider>
            {children}
          </ChainProvider>
        </RapidApiProvider>
      </BinanceWsProvider>
    </TokensProvider>
  );
}