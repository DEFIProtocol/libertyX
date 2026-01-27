// AdminDashboard.jsx - With Tabs
import './AdminAccess.css';
import { useState } from 'react';
import AdminTokenManager from './AdminTokenManager';
import { useTokens } from '../../contexts/TokenContext';
import AdminPricingManager from './AdminPricingManager';

function AdminDashboard({ onLogout }) {
    const { dbCount, jsonCount, errorDb, errorJson, comparisonMode } = useTokens();
    const [activeTab, setActiveTab] = useState('tokens'); // 'tokens' or 'pricing'
    
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
                            <AdminTokenManager />
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