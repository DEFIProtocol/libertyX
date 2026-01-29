import React, { useState, useCallback } from 'react';
import { useTokenCrud } from '../../hooks';

const EditTokenModal = React.memo(function EditTokenModal({ token, onClose, onSave, status, statusMessage }) {
    const { updateToken, loading } = useTokenCrud();
    const [formData, setFormData] = useState({
        name: token.name || '',
        price: token.price || '',
        market_cap: token.marketCap || token.market_cap || '',
        volume_24h: token.volume_24h || '',
        decimals: token.decimals || '',
        type: token.type || ''
    });

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }, []);

    const handleSave = useCallback(async () => {
        const result = await updateToken(token.symbol, formData);
        onSave(result);
    }, [token.symbol, formData, updateToken, onSave]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {status === 'loading' || loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div className="spinner" style={{ margin: '20px auto' }}></div>
                        <p style={{ color: '#4facfe', fontWeight: 600 }}>Updating token...</p>
                    </div>
                ) : status === 'success' ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <p style={{ fontSize: '2rem', margin: '20px 0' }}>✅</p>
                        <p style={{ color: '#10b981', fontWeight: 600, fontSize: '1.1rem' }}>
                            {statusMessage}
                        </p>
                    </div>
                ) : status === 'error' ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <p style={{ fontSize: '2rem', margin: '20px 0' }}>❌</p>
                        <p style={{ color: '#ef4444', fontWeight: 600, fontSize: '1rem' }}>
                            {statusMessage}
                        </p>
                        <button 
                            className="cancel-btn" 
                            onClick={() => {
                                // Stay in form to retry
                            }}
                            style={{ marginTop: '20px' }}
                        >
                            Try Again
                        </button>
                    </div>
                ) : (
                    <>
                        <h3>Edit Token: {token.symbol}</h3>
                        
                        <div className="form-group">
                            <label>Symbol</label>
                            <input 
                                type="text" 
                                value={token.symbol}
                                disabled
                                style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                            />
                        </div>

                        <div className="form-group">
                            <label>Name</label>
                            <input 
                                type="text" 
                                name="name" 
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Price</label>
                            <input 
                                type="number" 
                                name="price" 
                                value={formData.price}
                                onChange={handleChange}
                                step="0.00000001"
                            />
                        </div>

                        <div className="form-group">
                            <label>Market Cap</label>
                            <input 
                                type="number" 
                                name="market_cap" 
                                value={formData.market_cap}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Volume 24h</label>
                            <input 
                                type="number" 
                                name="volume_24h" 
                                value={formData.volume_24h}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Decimals</label>
                            <input 
                                type="number" 
                                name="decimals" 
                                value={formData.decimals}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="form-group">
                            <label>Type</label>
                            <input 
                                type="text" 
                                name="type" 
                                value={formData.type}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="modal-actions">
                            <button 
                                className="save-btn" 
                                onClick={handleSave} 
                                disabled={loading}
                            >
                                Save Changes
                            </button>
                            <button 
                                className="cancel-btn" 
                                onClick={onClose} 
                                disabled={loading}
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
});

export default EditTokenModal;
