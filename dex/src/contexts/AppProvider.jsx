import { TokensProvider } from './TokenContext';
import { ChainProvider } from './ChainContext';
import { RapidApiProvider } from './RapidApiContext';
import { BinanceWsProvider } from './BinanceWsContext';
import { CoinbaseWsProvider } from './CoinbaseWsContext';
import { GlobalPriceProvider } from './GlobalPriceContext';
import { OneInchProvider } from './OneInchContext';

export function AppProvider({ children }) {
  return (
    <TokensProvider>
      <BinanceWsProvider>
        <CoinbaseWsProvider>
          <RapidApiProvider>
            <GlobalPriceProvider>
              <OneInchProvider>
                <ChainProvider>
                  {children}
                </ChainProvider>
              </OneInchProvider>
            </GlobalPriceProvider>
          </RapidApiProvider>
        </CoinbaseWsProvider>
      </BinanceWsProvider>
    </TokensProvider>
  );
}