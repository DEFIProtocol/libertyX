import React from 'react';
import moment from 'moment';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import './token-chart.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

/**
 * StandardChart Component
 * Displays price history chart for a cryptocurrency
 * 
 * Props:
 *  - coinId (string): UUID of the coin to display
 *  - coinName (string): Name of coin for display
 *  - timePeriod (string): Initial time period ('24h', '7d', '30d', '1y', '5y')
 */
const DEFAULT_PERIODS = [
    { label: '24H', value: '24h' },
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: '1Y', value: '1y' },
    { label: '5Y', value: '5y' },
];

function StandardChart({
    coinHistory,
    loading,
    error,
    refetchHistory,
    timePeriod,
    onTimePeriodChange,
    periodOptions = DEFAULT_PERIODS,
}) {
    const history = coinHistory?.data?.history || [];
    const normalizedHistory = history
        .map((point) => {
            const price = Number.parseFloat(point?.price);
            return {
                timestamp: point?.timestamp,
                price,
            };
        })
        .filter((point) => Number.isFinite(point.price) && point.price > 0 && point.timestamp != null);

    const chartLabels = normalizedHistory.map(point => moment.unix(point.timestamp).format('YYYY-MM-DD'));
    const chartPrices = normalizedHistory.map(point => point.price);

    const data = {
        labels: [...chartLabels].reverse(),
        datasets: [
            {
                label: 'Price in USD',
                data: [...chartPrices].reverse(),
                borderColor: '#39ff14',
                backgroundColor: 'rgba(57, 255, 20, 0.15)',
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.35,
                fill: true,
                borderWidth: 2,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                displayColors: false,
                callbacks: {
                    label: (context) => {
                        const value = context.parsed.y;
                        if (value == null) return 'Price: --';
                        return `Price: $${value.toLocaleString('en-US', { maximumFractionDigits: 8 })}`;
                    },
                },
            },
            title: {
                display: false,
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    maxTicksLimit: 6,
                    color: '#9aa4b2',
                },
            },
            y: {
                beginAtZero: false,
                grid: {
                    color: 'rgba(148, 163, 184, 0.15)',
                },
                ticks: {
                    color: '#9aa4b2',
                    callback: (value) => {
                        if (value === 0) return '$0';
                        const num = Number(value);
                        return `$${num.toLocaleString('en-US', { maximumFractionDigits: 8 })}`;
                    },
                },
            },
        },
    };
  
    const containerClassName = [
        'chart-container',
        loading ? 'loading' : '',
        error ? 'error' : '',
    ]
        .filter(Boolean)
        .join(' ');

    const renderBody = () => {
        if (error) {
            return (
                <div className="chart-error">
                    <p>Unable to load price history</p>
                    <button onClick={() => refetchHistory()} className="retry-btn">
                        Retry
                    </button>
                </div>
            );
        }

        if (loading) {
            return (
                <div className="chart-loading">
                    <div className="spinner"></div>
                    <p>Loading price history...</p>
                </div>
            );
        }

        if (!normalizedHistory || normalizedHistory.length === 0) {
            return (
                <div className="chart-empty">
                    <p>No price history available</p>
                </div>
            );
        }

        return (
            <div style={{ height: 360, width: '100%' }}>
                <Line data={data} options={options} />
            </div>
        );
    };

    return (
        <div className={containerClassName}>
            <div className="chart-header">
                <div className="chart-title">
                    <h3>Price History</h3>
                </div>
                <div className="period-selector">
                    {periodOptions.map((period) => (
                        <button
                            key={period.value}
                            type="button"
                            className={`period-btn ${timePeriod === period.value ? 'active' : ''}`}
                            onClick={() => onTimePeriodChange?.(period.value)}
                            disabled={!onTimePeriodChange || loading}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>
            {renderBody()}
        </div>
    );
}

export default StandardChart;