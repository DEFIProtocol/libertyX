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
function StandardChart({ coinHistory, loading, error, refetchHistory }) {
    const history = coinHistory?.data?.history || [];

    const chartLabels = history.map(point => moment.unix(point.timestamp).format('YYYY-MM-DD'));
    const chartPrices = history.map(point => Number(point.price));

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
  
    // Error state
    if (error) {
        return (
            <div className="chart-container error">
                <div className="chart-error">
                    <p>Unable to load price history</p>
                    <button onClick={() => refetchHistory()} className="retry-btn">
                        Retry
                    </button>
                </div>
            </div>
        );
    }
  
    // Loading state
    if (loading) {
        return (
            <div className="chart-container loading">
                <div className="chart-loading">
                    <div className="spinner"></div>
                    <p>Loading price history...</p>
                </div>
            </div>
        );
    }
  
    // No data state
    if (!history || history.length === 0) {
        return (
            <div className="chart-container">
                <div className="chart-empty">
                    <p>No price history available</p>
                </div>
            </div>
        );
    }
  
    return (
        <div className="chart-container">
            <div style={{ height: 360, width: '100%' }}>
                <Line data={data} options={options} />
            </div>
        </div>
    );
}

export default StandardChart;