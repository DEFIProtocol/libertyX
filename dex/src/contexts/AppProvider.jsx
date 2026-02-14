// Import all your providers
import { TokensProvider } from './TokenContext';
import { ChainProvider } from './ChainContext';
import { RapidApiProvider } from './RapidApiContext';
import { BinanceWsProvider } from './BinanceWsContext';
import { CoinbaseWsProvider } from './CoinbaseWsContext';
import { GlobalPriceProvider } from './GlobalPriceContext';
import { OneInchProvider } from './OneInchContext';
import { UserProvider } from './UserContext';
import { ThemeProvider } from './ThemeContext'; // Import the ThemeProvider

export function AppProvider({ children }) {
  return (
    <ThemeProvider> {/* Wrap everything with ThemeProvider */}
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
    </ThemeProvider>
  );
}