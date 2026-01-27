// Example 3: Component for displaying coin history
import React, { useState } from 'react';
import { useCryptoChart } from '../hooks/useCrypto';

function CoinHistoryChart({ coinId }) {
    const [timePeriod, setTimePeriod] = useState('7d');
    const { priceHistory, loading, change } = useCryptoChart(coinId, timePeriod);

    const timePeriods = [
        { value: '24h', label: '24 Hours' },
        { value: '7d', label: '7 Days' },
        { value: '30d', label: '30 Days' },
        { value: '3m', label: '3 Months' },
        { value: '1y', label: '1 Year' }
    ];

    if (loading) return <div>Loading chart data...</div>;

    return (
        <div className="coin-chart">
            <div className="chart-controls">
                <select 
                    value={timePeriod} 
                    onChange={(e) => setTimePeriod(e.target.value)}
                >
                    {timePeriods.map(period => (
                        <option key={period.value} value={period.value}>
                            {period.label}
                        </option>
                    ))}
                </select>
                <div className="change-indicator">
                    Change: <span className={change?.startsWith('-') ? 'negative' : 'positive'}>
                        {change}%
                    </span>
                </div>
            </div>
            
            <div className="chart-container">
                {/* Render your chart using priceHistory */}
                {priceHistory.map((point, index) => (
                    <div key={index} className="chart-point">
                        {/* Chart rendering logic */}
                    </div>
                ))}
            </div>
        </div>
    );
}

export { CryptoDashboard, TokenPriceDisplay, CoinHistoryChart };