import React, { useState, useMemo } from 'react';
import { useGetCryptoHistoryQuery } from '../../hooks';
import './token-chart.css';

/**
 * StandardChart Component
 * Displays price history chart for a cryptocurrency
 * 
 * Props:
 *  - coinId (string): UUID of the coin to display
 *  - coinName (string): Name of coin for display
 *  - timePeriod (string): Initial time period ('24h', '7d', '30d', '1y', '5y')
 */
function StandardChart({ coinId, coinName = 'Crypto', timePeriod: initialPeriod = '24h' }) {
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  
  // Fetch history data for selected period
  const { 
    data: historyData, 
    isFetching: loading, 
    error,
    refetch: refetchHistory 
  } = useGetCryptoHistoryQuery(coinId, selectedPeriod);
  
  // Extract history array from response
  const history = useMemo(() => {
    return historyData?.data?.history || [];
  }, [historyData]);
  
  // Calculate chart dimensions and data
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;
    
    // Get min and max prices
    const prices = history.map(point => parseFloat(point.price) || 0);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1; // Avoid division by zero
    
    // Calculate percentage change
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const percentChange = ((endPrice - startPrice) / startPrice * 100).toFixed(2);
    
    return {
      prices,
      minPrice,
      maxPrice,
      priceRange,
      percentChange,
      isPositive: percentChange >= 0
    };
  }, [history]);
  
  // Format price display
  const formatPrice = (price) => {
    const num = parseFloat(price);
    if (num >= 1) {
      return `$${num.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`;
    }
    return `$${num.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 8 
    })}`;
  };
  
  // Format timestamp based on period
  const formatTimestamp = (timestamp, period) => {
    const date = new Date(timestamp * 1000);
    
    switch(period) {
      case '24h':
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      case '7d':
      case '30d':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case '1y':
      case '5y':
        return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      default:
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
  };
  
  // Generate SVG path for chart line
  const generateChartPath = () => {
    if (!history || history.length < 2 || !chartData) return '';
    
    const width = 600;
    const height = 300;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    let path = '';
    
    history.forEach((point, index) => {
      const price = parseFloat(point.price) || 0;
      const normalizedPrice = (price - chartData.minPrice) / chartData.priceRange;
      
      const x = padding + (index / (history.length - 1)) * chartWidth;
      const y = padding + (1 - normalizedPrice) * chartHeight;
      
      path += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    
    return path;
  };
  
  // Period buttons
  const periods = ['24h', '7d', '30d', '1y', '5y'];
  
  // Error state
  if (error) {
    return (
      <div className="chart-container error">
        <div className="chart-header">
          <h3>{coinName} Price History</h3>
        </div>
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
        <div className="chart-header">
          <h3>{coinName} Price History</h3>
        </div>
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
        <div className="chart-header">
          <h3>{coinName} Price History</h3>
        </div>
        <div className="chart-empty">
          <p>No price history available</p>
        </div>
      </div>
    );
  }
  
  const startPrice = chartData.prices[0];
  const endPrice = chartData.prices[chartData.prices.length - 1];
  
  return (
    <div className="chart-container">
      {/* Header with coin name and stats */}
      <div className="chart-header">
        <div className="chart-title">
          <h3>{coinName} Price History</h3>
          <div className={`price-stat ${chartData.isPositive ? 'positive' : 'negative'}`}>
            <span className="price">{formatPrice(endPrice)}</span>
            <span className="change">
              {chartData.isPositive ? '+' : ''}{chartData.percentChange}%
            </span>
          </div>
        </div>
        
        {/* Period selector buttons */}
        <div className="period-selector">
          {periods.map(period => (
            <button
              key={period}
              className={`period-btn ${selectedPeriod === period ? 'active' : ''}`}
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      
      {/* SVG Chart */}
      <div className="chart-wrapper">
        <svg 
          className="chart-svg" 
          viewBox="0 0 600 300" 
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Grid lines */}
          <g className="grid">
            <line x1="40" y1="250" x2="560" y2="250" stroke="#e0e0e0" strokeWidth="1" />
            <line x1="40" y1="200" x2="560" y2="200" stroke="#f0f0f0" strokeWidth="1" />
            <line x1="40" y1="150" x2="560" y2="150" stroke="#f0f0f0" strokeWidth="1" />
            <line x1="40" y1="100" x2="560" y2="100" stroke="#f0f0f0" strokeWidth="1" />
            <line x1="40" y1="50" x2="560" y2="50" stroke="#e0e0e0" strokeWidth="1" />
          </g>
          
          {/* Gradient fill under line */}
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop 
                offset="0%" 
                stopColor={chartData.isPositive ? '#10b981' : '#ef4444'} 
                stopOpacity="0.3" 
              />
              <stop 
                offset="100%" 
                stopColor={chartData.isPositive ? '#10b981' : '#ef4444'} 
                stopOpacity="0" 
              />
            </linearGradient>
          </defs>
          
          {/* Fill area */}
          <path
            d={`${generateChartPath()} L 560 250 L 40 250 Z`}
            fill="url(#chartGradient)"
          />
          
          {/* Price line */}
          <path
            d={generateChartPath()}
            fill="none"
            stroke={chartData.isPositive ? '#10b981' : '#ef4444'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Y-axis labels */}
          <text x="35" y="55" textAnchor="end" className="axis-label">
            {formatPrice(chartData.maxPrice)}
          </text>
          <text x="35" y="255" textAnchor="end" className="axis-label">
            {formatPrice(chartData.minPrice)}
          </text>
        </svg>
      </div>
      
      {/* Chart statistics */}
      <div className="chart-stats">
        <div className="stat-item">
          <label>High</label>
          <span className="value">{formatPrice(chartData.maxPrice)}</span>
        </div>
        <div className="stat-item">
          <label>Low</label>
          <span className="value">{formatPrice(chartData.minPrice)}</span>
        </div>
        <div className="stat-item">
          <label>Start</label>
          <span className="value">{formatPrice(startPrice)}</span>
        </div>
        <div className="stat-item">
          <label>End</label>
          <span className="value">{formatPrice(endPrice)}</span>
        </div>
      </div>
      
      {/* X-axis labels (sample timestamps) */}
      <div className="chart-labels">
        <span className="label-time">
          {formatTimestamp(history[0].timestamp, selectedPeriod)}
        </span>
        <span className="label-time">
          {formatTimestamp(history[Math.floor(history.length / 2)].timestamp, selectedPeriod)}
        </span>
        <span className="label-time">
          {formatTimestamp(history[history.length - 1].timestamp, selectedPeriod)}
        </span>
      </div>
    </div>
  );
}

export default StandardChart;
