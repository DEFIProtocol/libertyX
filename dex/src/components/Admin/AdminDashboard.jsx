// AdminDashboard.jsx - With Tabs
import './AdminAccess.css';
import { useMemo, useState } from 'react';
import AdminTokenManager from './AdminTokenManager';
import { useTokens } from '../../contexts/TokenContext';
import { useBinanceWs } from '../../contexts/BinanceWsContext';
import { useGlobalPriceTokens } from '../../hooks/useGlobalPriceTokens';
import AdminPricingManager from './AdminPricingManager';

function AdminDashboard({ onLogout }) {
    const [activeTab, setActiveTab] = useState('tokens');

    const {
        comparisonData,
        comparisonMode,
        errorDb,
        errorJson,
        dbCount,
        jsonCount
    } = useTokens();

    const { latestData } = useBinanceWs();
    const {
        tokens: baseTokens,
        loading: loadingMarket
    } = useGlobalPriceTokens();

    const binanceBySymbol = useMemo(() => {
        const map = {};
        if (Array.isArray(latestData)) {
            latestData.forEach((ticker) => {
                if (ticker?.s && ticker?.c && ticker.s.endsWith('USDT')) {
                    const base = ticker.s.replace(/USDT$/i, '').toUpperCase();
                    map[base] = ticker;
                }
            });
        }
        return map;
    }, [latestData]);

    const enrichedTokens = useMemo(() => {
        if (!Array.isArray(baseTokens)) return [];

        return baseTokens.map((token) => {
            const symbol = token?.symbol?.toUpperCase();
            const binanceTicker = symbol ? binanceBySymbol[symbol] : null;

            const binancePrice = binanceTicker?.c ? parseFloat(binanceTicker.c) : null;
            const resolvedPrice = binancePrice ?? (token?.price ? parseFloat(token.price) : null);
            const change = binanceTicker?.P ? parseFloat(binanceTicker.P) : (token?.change ? parseFloat(token.change) : null);

            return {
                ...token,
                symbol,
                price: resolvedPrice !== null ? resolvedPrice.toString() : token.price?.toString() || '0',
                marketCap: token.marketCap?.toString() || token.market_cap?.toString() || '0',
                change: change !== null ? change.toString() : '0',
                source: binancePrice !== null ? 'binance' : (token.priceSource || token.source || 'store')
            };
        });
    }, [baseTokens, binanceBySymbol]);

    const displayTokens = comparisonMode ? (comparisonData || []) : enrichedTokens;

    return (
        <div className="admin-container">
            <div className="admin-dashboard">
                {/* Header */}
                <div className="admin-header">
                    <div className="header-left">
                        <h1 className="admin-title">Admin Dashboard</h1>
                        <div className="data-source-summary">
                            <div className="source-summary-item">
                                <span className="summary-icon">🛢️</span>
                                <span className="summary-label">PostgreSQL:</span>
                                <span className={`summary-value ${errorDb ? 'error' : ''}`}>
                                    {errorDb ? '❌ Error' : `${dbCount} tokens`}
                                </span>
                            </div>
                            <div className="source-summary-item">
                                <span className="summary-icon">📄</span>
                                <span className="summary-label">JSON File:</span>
                                <span className={`summary-value ${errorJson ? 'error' : ''}`}>
                                    {errorJson ? '❌ Error' : `${jsonCount} tokens`}
                                </span>
                            </div>
                            {comparisonMode && (
                                <div className="source-summary-item highlight">
                                    <span className="summary-icon">🔍</span>
                                    <span className="summary-label">Comparison Mode Active</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={onLogout} className="logout-button">
                        Logout
                    </button>
                </div>
                
                {/* Tabs Navigation */}
                <div className="admin-tabs">
                    <button 
                        className={`tab-button ${activeTab === 'tokens' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tokens')}
                    >
                        <span className="tab-icon">🗂️</span>
                        Token Manager
                        {comparisonMode && activeTab === 'tokens' && (
                            <span className="tab-badge">🔍</span>
                        )}
                    </button>
                    <button 
                        className={`tab-button ${activeTab === 'pricing' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pricing')}
                    >
                        <span className="tab-icon">💰</span>
                        Pricing Manager
                    </button>
                </div>
                
                {/* Tab Content */}
                <div className="admin-content">
                    {activeTab === 'tokens' ? (
                        <div className="admin-card full-width">
                            <AdminTokenManager tokens={displayTokens} isLoading={loadingMarket} />
                        </div>
                    ) : (
                        <div className="admin-card full-width">
                            <AdminPricingManager />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminDashboard;