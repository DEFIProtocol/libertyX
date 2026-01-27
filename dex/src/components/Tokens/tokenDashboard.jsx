// Example 1: Simple component using hooks
import React from 'react';
import { useCryptoList, useCryptoDetails, useCryptoChart } from './hooks/useCrypto';

function CryptoDashboard() {
    // Get all coins
    const { coins, loading: marketLoading } = useCryptoList(100);
    
    // Get details for first coin
    const firstCoinId = coins[0]?.uuid;
    const { coin: firstCoin, loading: detailsLoading } = useCryptoDetails(firstCoinId);
    
    // Get chart data for first coin
    const { priceHistory, loading: chartLoading } = useCryptoChart(firstCoinId, '30d');

    if (marketLoading) return <div>Loading market data...</div>;

    return (
        <div>
            <h1>Crypto Dashboard</h1>
            <div>Total Coins: {coins.length}</div>
            
            {firstCoin && (
                <div>
                    <h2>{firstCoin.name} ({firstCoin.symbol})</h2>
                    <p>Price: ${firstCoin.price}</p>
                    <p>24h Change: {firstCoin.change}%</p>
                    
                    {!chartLoading && priceHistory.length > 0 && (
                        <div>
                            <h3>Price Chart (30 days)</h3>
                            {/* Render your chart here */}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


