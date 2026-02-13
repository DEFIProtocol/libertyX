// components/AccountSettings.jsx
import React, { useState, useEffect } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import { useChainContext } from '../../contexts/ChainContext';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { toast } from 'react-hot-toast';
import './AccountSettings.css';

const AccountSettings = () => {
  const { currentUser, updateUserById, loading } = useUserContext();
  const { availableChains, selectedChain, setSelectedChain } = useChainContext();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [preferences, setPreferences] = useState({
    theme: 'dark',
    defaultView: 'trading',
    notifications: {
      email: {
        tradeExecuted: true,
        orderFilled: true,
        priceAlerts: true,
        securityAlerts: true,
        newsletter: false
      }
    },
    trading: {
      slippageTolerance: 0.5,
      defaultOrderType: 'market',
      showConfirmationDialogs: true,
      favoritePairs: []
    },
    privacy: {
      showBalanceInNav: true,
      shareTradingActivity: false
    },
    enabledChains: ['1'],
    email: '',
    emailVerified: false
  });

  const [connectedChains, setConnectedChains] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser?.preferences) {
      setPreferences(prev => ({
        ...prev,
        ...currentUser.preferences
      }));
    }
    
    if (currentUser?.chainAddresses) {
      setConnectedChains(currentUser.chainAddresses);
    }
  }, [currentUser]);

  const handleConnectChain = async (chain) => {
    try {
      connect({ 
        connector: connectors.find(c => c.name.toLowerCase().includes(chain.key)),
        chainId: parseInt(chain.id)
      });
      
      toast.success(`Connecting to ${chain.label}...`, {
        style: {
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
        },
        iconTheme: {
          primary: 'var(--accent)',
          secondary: 'var(--accent-contrast)',
        },
      });
    } catch (error) {
      toast.error(`Failed to connect to ${chain.label}`);
    }
  };

  const handleDisconnectChain = async (chain) => {
    try {
      disconnect();
      
      const updatedChainAddresses = { ...connectedChains };
      delete updatedChainAddresses[chain.id];
      
      if (currentUser?.id) {
        await updateUserById(currentUser.id, {
          chainAddresses: updatedChainAddresses
        });
        setConnectedChains(updatedChainAddresses);
      }
      
      toast.success(`Disconnected from ${chain.label}`);
    } catch (error) {
      toast.error(`Failed to disconnect from ${chain.label}`);
    }
  };

  const savePreferences = async () => {
    if (!currentUser?.id) {
      toast.error('No user logged in');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserById(currentUser.id, {
        preferences: preferences
      });
      toast.success('Preferences saved successfully');
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmailChange = (e) => {
    setPreferences(prev => ({
      ...prev,
      email: e.target.value
    }));
  };

  const handleVerifyEmail = async () => {
    toast.success('Verification email sent');
  };

  return (
    <div className="settings-container">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-content">
          <h1 className="settings-title">Account Settings</h1>
          <p className="settings-subtitle">Customize your trading experience</p>
        </div>
        <div className="settings-header-actions">
          <button
            onClick={savePreferences}
            disabled={isSaving || loading}
            className="btn btn-primary"
          >
            {isSaving ? (
              <>
                <span className="loading-spinner" />
                Saving...
              </>
            ) : (
              <>
                <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      <div className="settings-grid">
        {/* Connected Chains Section */}
        <section className="settings-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-wrapper">
                <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="section-title">Connected Chains</h2>
                <p className="section-description">Manage your blockchain connections</p>
              </div>
            </div>
          </div>
          
          <div className="chains-grid">
            {availableChains.map((chain) => {
              const isConnected = !!connectedChains[chain.id];
              
              return (
                <div key={chain.id} className={`chain-card ${isConnected ? 'connected' : ''}`}>
                  <div className="chain-card-header">
                    <div className={`chain-status ${isConnected ? 'connected' : 'disconnected'}`} />
                    <span className="chain-name">{chain.label}</span>
                  </div>
                  
                  {isConnected && connectedChains[chain.id] && (
                    <div className="chain-address">
                      <span className="address-label">Connected as</span>
                      <span className="address-value">
                        {connectedChains[chain.id].substring(0, 6)}...
                        {connectedChains[chain.id].substring(38)}
                      </span>
                    </div>
                  )}
                  
                  <div className="chain-card-footer">
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnectChain(chain)}
                        className="btn btn-outline btn-danger w-full"
                      >
                        <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectChain(chain)}
                        className="btn btn-primary w-full"
                      >
                        <svg className="btn-icon" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Email & Notifications Section */}
        <section className="settings-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-wrapper">
                <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeLinecap="round" />
                  <polyline points="22,6 12,13 2,6" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="section-title">Email Notifications</h2>
                <p className="section-description">Stay updated on your trades</p>
              </div>
            </div>
          </div>

          <div className="email-input-group">
            <div className="input-wrapper">
              <svg className="input-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <input
                type="email"
                value={preferences.email}
                onChange={handleEmailChange}
                placeholder="your@email.com"
                className="email-input"
              />
              {preferences.email && !preferences.emailVerified && (
                <button
                  onClick={handleVerifyEmail}
                  className="btn btn-outline btn-sm verify-btn"
                >
                  Verify
                </button>
              )}
            </div>
            {preferences.emailVerified && (
              <div className="verified-badge">
                <svg className="verified-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verified
              </div>
            )}
          </div>

          <div className="notification-grid">
            {Object.entries(preferences.notifications.email).map(([key, value]) => (
              <label key={key} className="toggle-item">
                <span className="toggle-label">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      notifications: {
                        email: {
                          ...prev.notifications.email,
                          [key]: e.target.checked
                        }
                      }
                    }))}
                    className="toggle-input"
                  />
                  <span className="toggle-slider" />
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Appearance Section */}
        <section className="settings-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-wrapper">
                <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="section-title">Appearance</h2>
                <p className="section-description">Customize your interface</p>
              </div>
            </div>
          </div>

          <div className="select-group">
            <div className="select-wrapper">
              <label className="select-label">Theme</label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value }))}
                className="select-input"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="select-wrapper">
              <label className="select-label">Default View</label>
              <select
                value={preferences.defaultView}
                onChange={(e) => setPreferences(prev => ({ ...prev, defaultView: e.target.value }))}
                className="select-input"
              >
                <option value="trading">Trading</option>
                <option value="portfolio">Portfolio</option>
                <option value="analytics">Analytics</option>
              </select>
            </div>
          </div>

          <label className="toggle-item">
            <span className="toggle-label">Show balance in navigation</span>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.privacy.showBalanceInNav}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  privacy: {
                    ...prev.privacy,
                    showBalanceInNav: e.target.checked
                  }
                }))}
                className="toggle-input"
              />
              <span className="toggle-slider" />
            </div>
          </label>
        </section>

        {/* Trading Preferences Section */}
        <section className="settings-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-wrapper">
                <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="section-title">Trading Preferences</h2>
                <p className="section-description">Fine-tune your trading experience</p>
              </div>
            </div>
          </div>

          <div className="slippage-control">
            <div className="slippage-header">
              <span className="slippage-label">Slippage Tolerance</span>
              <span className="slippage-value">{preferences.trading.slippageTolerance}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={preferences.trading.slippageTolerance}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                trading: {
                  ...prev.trading,
                  slippageTolerance: parseFloat(e.target.value)
                }
              }))}
              className="slippage-slider"
            />
            <div className="slippage-markers">
              <span>0.1%</span>
              <span>2.5%</span>
              <span>5%</span>
            </div>
          </div>

          <div className="select-wrapper">
            <label className="select-label">Default Order Type</label>
            <select
              value={preferences.trading.defaultOrderType}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                trading: {
                  ...prev.trading,
                  defaultOrderType: e.target.value
                }
              }))}
              className="select-input"
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
              <option value="stop">Stop Loss</option>
            </select>
          </div>

          <label className="toggle-item">
            <span className="toggle-label">Show confirmation dialogs</span>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.trading.showConfirmationDialogs}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  trading: {
                    ...prev.trading,
                    showConfirmationDialogs: e.target.checked
                  }
                }))}
                className="toggle-input"
              />
              <span className="toggle-slider" />
            </div>
          </label>

          <label className="toggle-item">
            <span className="toggle-label">Share trading activity</span>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={preferences.privacy.shareTradingActivity}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  privacy: {
                    ...prev.privacy,
                    shareTradingActivity: e.target.checked
                  }
                }))}
                className="toggle-input"
              />
              <span className="toggle-slider" />
            </div>
          </label>
        </section>

        {/* Active Chains Section */}
        <section className="settings-section">
          <div className="section-header">
            <div className="section-header-left">
              <div className="section-icon-wrapper">
                <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeLinecap="round" />
                  <path d="M12 2a15 15 0 000 20 15 15 0 000-20z" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="section-title">Active Chains</h2>
                <p className="section-description">Choose which chains to display</p>
              </div>
            </div>
          </div>

          <div className="chains-select-grid">
            {availableChains.map((chain) => (
              <label key={chain.id} className="chain-select-item">
                <input
                  type="checkbox"
                  checked={preferences.enabledChains?.includes(chain.id)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...(preferences.enabledChains || []), chain.id]
                      : (preferences.enabledChains || []).filter(id => id !== chain.id);
                    
                    setPreferences(prev => ({
                      ...prev,
                      enabledChains: updated
                    }));
                  }}
                  className="chain-checkbox"
                />
                <span className="chain-select-label">{chain.label}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountSettings;