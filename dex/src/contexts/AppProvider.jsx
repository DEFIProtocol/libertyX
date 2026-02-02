import { TokensProvider } from './TokenContext';
import { ChainProvider } from './ChainContext';
import { RapidApiProvider } from './RapidApiContext';
import { BinanceWsProvider } from './BinanceWsContext';
import { OneInchProvider } from './OneInchContext';

export function AppProvider({ children }) {
  return (
    <TokensProvider>
      <BinanceWsProvider>
        <RapidApiProvider>
          <OneInchProvider>
            <ChainProvider>
              {children}
            </ChainProvider>
          </OneInchProvider>
        </RapidApiProvider>
      </BinanceWsProvider>
    </TokensProvider>
  );
}