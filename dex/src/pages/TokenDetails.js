import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTokens } from '../contexts/TokenContext';
import { useGetCryptoDetailsQuery, useGetCryptoHistoryQuery } from '../hooks';
import { CheckOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { useUserContext } from '../contexts/UserContext';
import StandardChart from '../components/TokenPage/StandardChart';
import MarketOrder from '../components/TokenPage/MarketOrder';
import TradingViewChart from '../components/TokenPage/TradingViewChart';
import './Tokens.css';

function TokenDetails({ address }) {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const { displayTokens } = useTokens();
  const { isInWatchlist, toggleWatchlistToken } = useUserContext();
  const [timePeriod, setTimePeriod] = useState('24h');
  const [showFullChart, setShowFullChart] = useState(false);

  // Fetch detailed coin data from RapidAPI
  const {
    data: coinDetailsData,
    isFetching: loading,
    error: detailsError,
    refetch: refetchDetails
  } = useGetCryptoDetailsQuery(uuid);

  const {
    data: coinHistoryData,
    isFetching: historyLoading,
    error: historyError,
    refetch: refetchHistory
  } = useGetCryptoHistoryQuery(uuid, timePeriod);

  // Extract coin details from response
  const coinDetails = useMemo(() => {
    return coinDetailsData?.data?.coin || null;
  }, [coinDetailsData]);

  // Get local token data from context if available
  const localTokenData = useMemo(() => {
    if (!displayTokens) return null;
    return displayTokens.find(token => token.uuid === uuid);
  }, [displayTokens, uuid]);

  // Combine local and API data
  const combinedData = useMemo(() => {
    if (!coinDetails) return null;

    const apiData = {
      uuid: coinDetails.uuid,
      name: coinDetails.name,
      symbol: coinDetails.symbol,
      description: coinDetails.description,
      iconUrl: coinDetails.iconUrl,
      website: coinDetails.websiteUrl,
      price: coinDetails.price,
      marketCap: coinDetails.marketCap,
      volume24h: coinDetails['24hVolume'],
      change: coinDetails.change,
      rank: coinDetails.rank,
      btcPrice: coinDetails.btcPrice,
      allTimeHigh: coinDetails.allTimeHigh?.price,
      allTimeLow: coinDetails.allTimeLow?.price,
      links: coinDetails.links,
      supply: coinDetails.supply,
      maxSupply: coinDetails.maxSupply,
      approvedSupply: coinDetails.approvedSupply,
      totalSupply: coinDetails.totalSupply,
    };

    return {
      ...apiData,
      // Add local data if available (e.g., addresses, type, decimals)
      addresses: localTokenData?.addresses,
      type: localTokenData?.type,
      decimals: localTokenData?.decimals,
    };
  }, [coinDetails, localTokenData]);

  const tradingViewSymbol = useMemo(() => {
    if (!combinedData?.symbol) return null;
    return `CRYPTO:${combinedData.symbol.toUpperCase()}USD`;
  }, [combinedData?.symbol]);

  // Format large numbers
  const formatNumber = (num) => {
    if (!num) return '--';
    const n = parseFloat(num);
    if (isNaN(n)) return '--';

    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
    return n.toFixed(2);
  };

  const formatPrice = (price) => {
    if (!price) return '$0.00';
    const num = parseFloat(price);
    if (isNaN(num)) return '$0.00';

    if (num >= 1) {
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (num >= 0.01) {
      return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
    }
    return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
  };

  // Loading state
  if (loading && !coinDetails) {
    return (
      <div className="token-details-page">
        <button className="back-button" onClick={() => navigate('/tokens')}>
          ← Back to Tokens
        </button>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading token details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (detailsError || !combinedData) {
    return (
      <div className="token-details-page">
        <button className="back-button" onClick={() => navigate('/tokens')}>
          ← Back to Tokens
        </button>
        <div className="error-container">
          <p>Unable to load token details</p>
          {uuid && (
            <div className="error-details">
              <p className="error-uuid">UUID: {uuid}</p>
              <p className="error-message">{detailsError?.message || 'Unknown error'}</p>
            </div>
          )}
          <button onClick={() => refetchDetails()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const percentChange = parseFloat(combinedData.change) || 0;
  const isPositiveChange = percentChange >= 0;
  const isWatchlisted = isInWatchlist(combinedData);

  return (
    <div className="token-details-page">
      {/* Header with back button */}
      <button className="back-button" onClick={() => navigate('/tokens')}>
        ← Back to Tokens
      </button>

      {/* Coin Header Card */}
      <div className="coin-header-card">
        <div className="coin-hero">
          <div className="coin-icon-large">
            <img
              src={combinedData.iconUrl}
              alt={combinedData.name}
              onError={(e) => {
                e.target.src = '/placeholder-coin.png';
              }}
            />
          </div>

          <div className="coin-title-section">
            <div className="coin-title">
              <h1>{combinedData.name}</h1>
              <span className="coin-symbol">{combinedData.symbol}</span>
              <span className="coin-rank">Rank #{combinedData.rank}</span>
            </div>

            <div className={`price-section ${isPositiveChange ? 'positive' : 'negative'}`}>
              <div className="current-price">
                <span className="label">Current Price</span>
                <span className="price">{formatPrice(combinedData.price)}</span>
              </div>
              <div className="price-change">
                <span className={`change-badge ${isPositiveChange ? 'positive' : 'negative'}`}>
                  {isPositiveChange ? '+' : ''}{percentChange.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div className="coin-actions">
            <button
              className={`watchlist-btn ${isWatchlisted ? 'added' : ''}`}
              onClick={() => toggleWatchlistToken(combinedData)}
              type="button"
              aria-label={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
              title={isWatchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {isWatchlisted ? <CheckOutlined /> : <PlusCircleOutlined />}
            </button>
            <button 
              className="action-button primary"
              onClick={() => refetchDetails()}
              disabled={loading}
            >
              {loading ? '⏳ Updating...' : '↻ Refresh'}
            </button>

            {combinedData.website && (
              <a
                href={combinedData.website}
                target="_blank"
                rel="noopener noreferrer"
                className="action-button secondary"
              >
                🔗 Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <label>Market Cap</label>
          <span className="stat-value">${formatNumber(combinedData.marketCap)}</span>
          <span className="stat-unit">USD</span>
        </div>

        <div className="stat-card">
          <label>24h Volume</label>
          <span className="stat-value">${formatNumber(combinedData.volume24h)}</span>
          <span className="stat-unit">USD</span>
        </div>

        <div className="stat-card">
          <label>BTC Price</label>
          <span className="stat-value">{parseFloat(combinedData.btcPrice || 0).toFixed(8)}</span>
          <span className="stat-unit">BTC</span>
        </div>

        <div className="stat-card">
          <label>All-Time High</label>
          <span className="stat-value">{formatPrice(combinedData.allTimeHigh)}</span>
          <span className="stat-unit">USD</span>
        </div>

        <div className="stat-card">
          <label>All-Time Low</label>
          <span className="stat-value">{formatPrice(combinedData.allTimeLow)}</span>
          <span className="stat-unit">USD</span>
        </div>

        <div className="stat-card">
          <label>Circulating Supply</label>
          <span className="stat-value">{formatNumber(combinedData.supply)}</span>
          <span className="stat-unit">{combinedData.symbol}</span>
        </div>
      </div>

      {/* Chart Section */}
      <div className="full-chart-actions">
        <button
          type="button"
          className="full-chart-toggle"
          onClick={() => setShowFullChart((prev) => !prev)}
          disabled={!tradingViewSymbol}
        >
          Full featured chart
        </button>
      </div>

      {showFullChart && (
        <div className="full-chart-section">
          {tradingViewSymbol ? (
            <TradingViewChart symbol={tradingViewSymbol} />
          ) : (
            <div className="full-chart-empty">
              <p>Full featured chart is unavailable for this token.</p>
            </div>
          )}
        </div>
      )}

      {!showFullChart && (
        <div className="chart-order-grid">
          <div className="chart-panel">
            <StandardChart
              coinHistory={coinHistoryData}
              loading={historyLoading}
              error={historyError}
              refetchHistory={refetchHistory}
              timePeriod={timePeriod}
              onTimePeriodChange={setTimePeriod}
            />
          </div>
          <div className="order-panel">
            <h3 className="order-panel-title">Market Order</h3>
            <MarketOrder
              address={address}
              usdPrice={combinedData.price}
              tokenName={combinedData.name}
              symbol={combinedData.symbol}
              decimals={combinedData.decimals || 18}
            />
          </div>
        </div>
      )}

      {/* Description Section */}
      {combinedData.description && (
        <div className="description-card">
          <h3>About {combinedData.name}</h3>
          <div className="description-text">
            {combinedData.description}
          </div>
        </div>
      )}

      {/* Supply Information */}
      <div className="supply-card">
        <h3>Supply Information</h3>
        <div className="supply-grid">
          {combinedData.supply && (
            <div className="supply-item">
              <label>Circulating Supply</label>
              <span className="supply-value">
                {formatNumber(combinedData.supply)} {combinedData.symbol}
              </span>
            </div>
          )}

          {combinedData.totalSupply && (
            <div className="supply-item">
              <label>Total Supply</label>
              <span className="supply-value">
                {formatNumber(combinedData.totalSupply)} {combinedData.symbol}
              </span>
            </div>
          )}

          {combinedData.maxSupply && (
            <div className="supply-item">
              <label>Max Supply</label>
              <span className="supply-value">
                {formatNumber(combinedData.maxSupply)} {combinedData.symbol}
              </span>
            </div>
          )}

          {combinedData.approvedSupply && (
            <div className="supply-item">
              <label>Approved Supply</label>
              <span className="supply-value">
                {formatNumber(combinedData.approvedSupply)} {combinedData.symbol}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Links Section */}
      {combinedData.links && combinedData.links.length > 0 && (
        <div className="links-card">
          <h3>Links & Resources</h3>
          <div className="links-grid">
            {combinedData.links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-item"
              >
                <span className="link-name">{link.name}</span>
                <span className="link-type">→</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Network Addresses Section */}
      {combinedData.addresses && Object.keys(combinedData.addresses).length > 0 && (
        <div className="addresses-card">
          <h3>Network Addresses</h3>
          <div className="addresses-list">
            {Object.entries(combinedData.addresses).map(([network, address]) => (
              <div key={network} className="address-item">
                <span className="network-label">{network}</span>
                <code className="address-value" title={address}>
                  {address}
                </code>
                <button
                  className="copy-button"
                  onClick={() => navigator.clipboard.writeText(address)}
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TokenDetails;
