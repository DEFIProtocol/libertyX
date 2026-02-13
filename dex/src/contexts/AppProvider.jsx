// Remove this incorrect import:
// import User from '/Users/beaua/Desktop/libertyX/libertyX/server/routes/user';

// Just keep your providers:
import { TokensProvider } from './TokenContext';
import { ChainProvider } from './ChainContext';
import { RapidApiProvider } from './RapidApiContext';
import { BinanceWsProvider } from './BinanceWsContext';
import { CoinbaseWsProvider } from './CoinbaseWsContext';
import { GlobalPriceProvider } from './GlobalPriceContext';
import { OneInchProvider } from './OneInchContext';
import { UserProvider } from './UserContext';

export function AppProvider({ children }) {
  return (
    <TokensProvider>
      <BinanceWsProvider>
        <CoinbaseWsProvider>
          <RapidApiProvider>
            <GlobalPriceProvider>
              <UserProvider>
                <OneInchProvider>
                  <ChainProvider>
                    {children}
                  </ChainProvider>
                </OneInchProvider>
              </UserProvider>
            </GlobalPriceProvider>
          </RapidApiProvider>
        </CoinbaseWsProvider>
      </BinanceWsProvider>
    </TokensProvider>
  );
}