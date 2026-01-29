import React, { useState, useCallback } from 'react';
import { useTokenCrud } from '../../hooks';

const AddTokenModal = React.memo(function AddTokenModal({ onClose, onSave, status, statusMessage }) {
    const { createToken, loading } = useTokenCrud();
    const [formData, setFormData] = useState({
        symbol: '',
        name: '',
        price: '',
        market_cap: '',
        volume_24h: '',
        decimals: '18',
        type: 'ERC-20'
    });

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }, []);

    const handleSave = useCallback(async () => {
        if (!formData.symbol || !formData.name) {
            alert('Symbol and Name are required');
            return;
        }
        const result = await createToken(formData);
        onSave(result);
    }, [formData, createToken, onSave]);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {status === 'loading' || loading ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div className="spinner" style={{ margin: '20px auto' }}></div>
                        <p style={{ color: '#4facfe', fontWeight: 600 }}>Adding token...</p>
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
                        <h3>Add New Token</h3>
                        
                        <div className="form-group">
                            <label>Symbol *</label>
                            <input 
                                type="text" 
                                name="symbol" 
                                value={formData.symbol}
                                onChange={handleChange}
                                placeholder="e.g., BTC"
                            />
                        </div>

                        <div className="form-group">
                            <label>Name *</label>
                            <input 
                                type="text" 
                                name="name" 
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Bitcoin"
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
                                placeholder="0.00"
                            />
                        </div>

                        <div className="form-group">
                            <label>Market Cap</label>
                            <input 
                                type="number" 
                                name="market_cap" 
                                value={formData.market_cap}
                                onChange={handleChange}
                                placeholder="0"
                            />
                        </div>

                        <div className="form-group">
                            <label>Volume 24h</label>
                            <input 
                                type="number" 
                                name="volume_24h" 
                                value={formData.volume_24h}
                                onChange={handleChange}
                                placeholder="0"
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
                                placeholder="e.g., ERC-20"
                            />
                        </div>

                        <div className="modal-actions">
                            <button 
                                className="save-btn" 
                                onClick={handleSave} 
                                disabled={loading}
                            >
                                Add Token
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

export default AddTokenModal;
