// AdminDashboard.jsx - With Tabs
import './AdminAccess.css';
import { useState, useMemo } from 'react';
import AdminTokenManager from './AdminTokenManager';
import { useTokens } from '../../contexts/TokenContext';
import { useGetCryptosQuery } from '../../hooks';
import AdminPricingManager from './AdminPricingManager';

function AdminDashboard({ onLogout }) {
    const { 
        displayTokens: contextTokens,
        dbCount, 
        jsonCount, 
        errorDb, 
        errorJson, 
        comparisonMode 
    } = useTokens();
    
    const [activeTab, setActiveTab] = useState('tokens'); // 'tokens' or 'pricing'
    
    // Get market data same way as Tokens.js
    const { 
        data: marketData, 
        isFetching: loadingMarket 
    } = useGetCryptosQuery(1200);
    
    // Extract coins array from market data
    const marketCoins = useMemo(() => {
        return marketData?.data?.coins || [];
    }, [marketData]);
    
    // Enrich tokens with market data - same pattern as Tokens.js
    const enrichedTokens = useMemo(() => {
        if (!contextTokens) return [];
        
        return contextTokens.map(token => {
            // Handle comparison mode vs normal mode
            let tokenData;
            if (comparisonMode) {
                tokenData = token.database || token.json;
            } else {
                tokenData = token;
            }
            
            if (!tokenData) return null;
            
            // Filter out tokens without uuid
            if (!tokenData.uuid) return null;
            
            // Find matching market coin
            const fullMarketCoin = marketCoins.find(coin => coin.uuid === tokenData.uuid);
            
            return {
                // Base token data
                ...tokenData,
                uuid: tokenData.uuid,
                symbol: tokenData.symbol || token.symbol,
                name: tokenData.name || token.symbol,
                image: tokenData.image,
                addresses: tokenData.addresses,
                type: tokenData.type,
                decimals: tokenData.decimals,
                
                // Price data from market data
                price: fullMarketCoin?.price || tokenData.price || '0',
                marketCap: fullMarketCoin?.marketCap || tokenData.market_cap || '0',
                change: fullMarketCoin?.change || '0',
                rank: fullMarketCoin?.rank || 9999,
                
                // For comparison mode
                inDatabase: comparisonMode ? token.inDatabase : true,
                inJson: comparisonMode ? token.inJson : false,
                isMatch: comparisonMode ? token.match : true
            };
        }).filter(token => token !== null);
    }, [contextTokens, marketCoins, comparisonMode]);
    
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
                            <AdminTokenManager tokens={enrichedTokens} isLoading={loadingMarket} />
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