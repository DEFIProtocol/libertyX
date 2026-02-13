// AdminUserManagement.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useUserContext } from '../../contexts/UserContext';
import './AdminUserManager.css';

// Simple debounce hook
function useSimpleDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    const timeoutRef = useRef(null);

    useEffect(() => {
        timeoutRef.current = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => clearTimeout(timeoutRef.current);
    }, [value, delay]);

    return debouncedValue;
}

// Main AdminUserManager Component
const AdminUserManager = React.memo(function AdminUserManager() {
    const { 
        users,
        loading,
        error,
        addUser,
        editUser,
        removeUser,
        refreshUsers,
        selectedUser,
        setSelectedUser
    } = useUserContext();

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useSimpleDebounce(searchTerm, 300);
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [addingUser, setAddingUser] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [bulkActionStatus, setBulkActionStatus] = useState({ type: '', message: '' });

    // Filtered and sorted users
    const filteredAndSortedUsers = useMemo(() => {
        if (!users?.length) return [];
        
        let filtered = [...users];
        
        // Apply search
        if (debouncedSearchTerm) {
            const term = debouncedSearchTerm.toLowerCase();
            filtered = filtered.filter(user => 
                user.wallet_address?.toLowerCase().includes(term) ||
                user.email?.toLowerCase().includes(term) ||
                user.username?.toLowerCase().includes(term) ||
                user.id?.toLowerCase().includes(term)
            );
        }
        
        // Apply sort
        if (sortConfig.key) {
            filtered.sort((a, b) => {
                let aVal, bVal;
                
                if (sortConfig.key === 'chain_count') {
                    aVal = Object.keys(a.chain_addresses || {}).length;
                    bVal = Object.keys(b.chain_addresses || {}).length;
                } else if (sortConfig.key === 'created_at' || sortConfig.key === 'updated_at') {
                    aVal = new Date(a[sortConfig.key] || 0).getTime();
                    bVal = new Date(b[sortConfig.key] || 0).getTime();
                } else {
                    aVal = (a[sortConfig.key] || '').toString().toLowerCase();
                    bVal = (b[sortConfig.key] || '').toString().toLowerCase();
                }
                
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        return filtered;
    }, [users, debouncedSearchTerm, sortConfig]);

    // Stats
    const stats = useMemo(() => ({
        total: users.length,
        verified: users.filter(u => u.is_verified_by_coinbase).length,
        withEmail: users.filter(u => u.email).length,
        withUsername: users.filter(u => u.username).length,
        totalChains: users.reduce((acc, u) => acc + Object.keys(u.chain_addresses || {}).length, 0)
    }), [users]);

    // Handlers
    const handleSort = useCallback((key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    const toggleRowExpansion = useCallback((userId) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    }, []);

    const toggleUserSelection = useCallback((user) => {
        setSelectedUsers(prev => {
            const exists = prev.some(u => u.id === user.id);
            if (exists) {
                return prev.filter(u => u.id !== user.id);
            }
            return [...prev, user];
        });
    }, []);

    const toggleAllSelection = useCallback(() => {
        if (selectedUsers.length === filteredAndSortedUsers.length) {
            setSelectedUsers([]);
        } else {
            setSelectedUsers([...filteredAndSortedUsers]);
        }
    }, [selectedUsers.length, filteredAndSortedUsers]);

    const handleAddUser = useCallback(async (userData) => {
        const result = await addUser(userData);
        if (result.success) {
            setAddingUser(false);
            setBulkActionStatus({
                type: 'success',
                message: `User ${userData.wallet_address} created successfully`
            });
            setTimeout(() => setBulkActionStatus({ type: '', message: '' }), 3000);
        } else {
            setBulkActionStatus({
                type: 'error',
                message: result.error || 'Failed to create user'
            });
        }
    }, [addUser]);

    const handleBulkDelete = useCallback(async () => {
        if (!selectedUsers.length) return;
        
        const confirmMsg = `Delete ${selectedUsers.length} user(s)? This action cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        let success = 0;
        let failed = 0;

        for (const user of selectedUsers) {
            const result = await removeUser(user.id);
            if (result.success) {
                success++;
            } else {
                failed++;
            }
        }

        setBulkActionStatus({
            type: failed ? 'warning' : 'success',
            message: `Deleted ${success} users${failed ? `, ${failed} failed` : ''}`
        });
        
        setSelectedUsers([]);
        setTimeout(() => setBulkActionStatus({ type: '', message: '' }), 3000);
    }, [selectedUsers, removeUser]);

    if (loading && !users.length) {
        return <div className="loading">Loading users...</div>;
    }

    return (
        <div className="admin-user-management">
            {/* Header */}
            <div className="manager-header">
                <div className="header-left">
                    <h2>User Management</h2>
                    <div className="stats">
                        <span className="stat-item">👥 Total: {stats.total}</span>
                        <span className="stat-item">✅ Verified: {stats.verified}</span>
                        <span className="stat-item">📧 With Email: {stats.withEmail}</span>
                        <span className="stat-item">🔗 Total Chains: {stats.totalChains}</span>
                    </div>
                </div>
                
                <div className="header-right">
                    <button 
                        onClick={() => setAddingUser(true)}
                        className="action-btn primary"
                        disabled={loading}
                    >
                        ➕ Add User
                    </button>
                    
                    {selectedUsers.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="action-btn danger"
                            disabled={loading}
                        >
                            🗑️ Delete Selected ({selectedUsers.length})
                        </button>
                    )}
                    
                    <button 
                        onClick={refreshUsers}
                        className="action-btn secondary"
                        disabled={loading}
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Status Messages */}
            {bulkActionStatus.message && (
                <div className={`status-message ${bulkActionStatus.type}`}>
                    {bulkActionStatus.message}
                </div>
            )}

            {error && (
                <div className="status-message error">
                    Error: {error}
                </div>
            )}

            {/* Search */}
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search by wallet, email, username, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            {/* Users Table */}
            <div className="table-container">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th className="checkbox-col">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0}
                                    onChange={toggleAllSelection}
                                />
                            </th>
                            <th className="sortable" onClick={() => handleSort('id')}>
                                UUID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('wallet_address')}>
                                Wallet Address {sortConfig.key === 'wallet_address' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('email')}>
                                Email {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('username')}>
                                Username {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('chain_count')}>
                                Chains {sortConfig.key === 'chain_count' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('is_verified_by_coinbase')}>
                                Verified {sortConfig.key === 'is_verified_by_coinbase' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="sortable" onClick={() => handleSort('created_at')}>
                                Created {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSortedUsers.map(user => {
                            const chainCount = Object.keys(user.chain_addresses || {}).length;
                            const isExpanded = expandedRows.has(user.id);
                            const isSelected = selectedUsers.some(u => u.id === user.id);

                            return (
                                <React.Fragment key={user.id}>
                                    <tr 
                                        className={`user-row ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
                                    >
                                        <td className="checkbox-col" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleUserSelection(user)}
                                            />
                                        </td>
                                        <td className="uuid-col" title={user.id}>
                                            {user.id.substring(0, 8)}...
                                        </td>
                                        <td className="wallet-col" title={user.wallet_address}>
                                            {user.wallet_address.substring(0, 6)}...{user.wallet_address.substring(38)}
                                        </td>
                                        <td>{user.email || '—'}</td>
                                        <td>{user.username || '—'}</td>
                                        <td className="chain-count">
                                            <span 
                                                className={`chain-badge ${chainCount > 0 ? 'has-chains' : ''}`}
                                                onClick={() => chainCount > 0 && toggleRowExpansion(user.id)}
                                            >
                                                {chainCount}
                                            </span>
                                        </td>
                                        <td>
                                            {user.is_verified_by_coinbase ? (
                                                <span className="verified-badge">✅</span>
                                            ) : '—'}
                                        </td>
                                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                                        <td className="actions-col">
                                            <button
                                                className="action-btn small primary"
                                                onClick={() => toggleRowExpansion(user.id)}
                                            >
                                                {isExpanded ? '▼' : '▶'} Details
                                            </button>
                                            <button
                                                className="action-btn small danger"
                                                onClick={() => {
                                                    if (window.confirm(`Delete user ${user.wallet_address}?`)) {
                                                        removeUser(user.id);
                                                    }
                                                }}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                    
                                    {isExpanded && (
                                        <tr className="details-row">
                                            <td colSpan="9">
                                                <AdminUserDetails 
                                                    user={user}
                                                    onUpdate={editUser}
                                                    onClose={() => toggleRowExpansion(user.id)}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        
                        {filteredAndSortedUsers.length === 0 && (
                            <tr>
                                <td colSpan="9" className="no-results">
                                    No users found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add User Modal */}
            {addingUser && (
                <AddUserModal
                    onClose={() => setAddingUser(false)}
                    onSave={handleAddUser}
                    loading={loading}
                />
            )}
        </div>
    );
});

// AdminUserDetails Component
const AdminUserDetails = React.memo(function AdminUserDetails({ user, onUpdate, onClose }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({ ...user });
    const [saveStatus, setSaveStatus] = useState(null);

    const handleSave = async () => {
        setSaveStatus('saving');
        const result = await onUpdate(user.id, editData);
        if (result.success) {
            setSaveStatus('success');
            setIsEditing(false);
            setTimeout(() => setSaveStatus(null), 2000);
        } else {
            setSaveStatus('error');
        }
    };

    return (
        <div className="user-details-expanded">
            <div className="details-header">
                <h4>User Details</h4>
                <button className="close-btn" onClick={onClose}>✕</button>
            </div>

            {saveStatus === 'success' && (
                <div className="save-status success">✓ Saved successfully!</div>
            )}
            
            <div className="details-grid">
                <div className="detail-item full-width">
                    <label>UUID</label>
                    <div className="value mono">{user.id}</div>
                </div>
                
                <div className="detail-item full-width">
                    <label>Wallet Address</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={editData.wallet_address || ''}
                            onChange={(e) => setEditData({...editData, wallet_address: e.target.value})}
                            className="edit-input mono"
                        />
                    ) : (
                        <div className="value mono">{user.wallet_address}</div>
                    )}
                </div>
                
                <div className="detail-item">
                    <label>Email</label>
                    {isEditing ? (
                        <input
                            type="email"
                            value={editData.email || ''}
                            onChange={(e) => setEditData({...editData, email: e.target.value})}
                            className="edit-input"
                            placeholder="user@example.com"
                        />
                    ) : (
                        <div className="value">{user.email || '—'}</div>
                    )}
                </div>
                
                <div className="detail-item">
                    <label>Username</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={editData.username || ''}
                            onChange={(e) => setEditData({...editData, username: e.target.value})}
                            className="edit-input"
                            placeholder="username"
                        />
                    ) : (
                        <div className="value">{user.username || '—'}</div>
                    )}
                </div>
                
                <div className="detail-item">
                    <label>Coinbase Verified</label>
                    {isEditing ? (
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={editData.is_verified_by_coinbase || false}
                                onChange={(e) => setEditData({...editData, is_verified_by_coinbase: e.target.checked})}
                            />
                            Verified
                        </label>
                    ) : (
                        <div className="value">
                            {user.is_verified_by_coinbase ? '✅ Verified' : '—'}
                        </div>
                    )}
                </div>
                
                <div className="detail-item">
                    <label>Created</label>
                    <div className="value">{new Date(user.created_at).toLocaleString()}</div>
                </div>
                
                <div className="detail-item">
                    <label>Updated</label>
                    <div className="value">{new Date(user.updated_at).toLocaleString()}</div>
                </div>
            </div>

            {/* Chain Addresses Section */}
            <div className="chain-addresses-section">
                <h4>Chain Addresses ({Object.keys(user.chain_addresses || {}).length})</h4>
                {isEditing ? (
                    <ChainAddressesEditor
                        addresses={editData.chain_addresses || {}}
                        onChange={(addresses) => setEditData({...editData, chain_addresses: addresses})}
                    />
                ) : (
                    <div className="addresses-grid">
                        {Object.entries(user.chain_addresses || {}).map(([chain, address]) => (
                            <div key={chain} className="address-item">
                                <span className="chain-name">{chain}:</span>
                                <span className="address mono">{address}</span>
                            </div>
                        ))}
                        {Object.keys(user.chain_addresses || {}).length === 0 && (
                            <div className="no-data">No chain addresses</div>
                        )}
                    </div>
                )}
            </div>

            <div className="actions-section">
                {isEditing ? (
                    <>
                        <button
                            className="action-btn success"
                            onClick={handleSave}
                            disabled={saveStatus === 'saving'}
                        >
                            {saveStatus === 'saving' ? '💾 Saving...' : 'Save Changes'}
                        </button>
                        <button
                            className="action-btn secondary"
                            onClick={() => {
                                setEditData({ ...user });
                                setIsEditing(false);
                            }}
                        >
                            Cancel
                        </button>
                    </>
                ) : (
                    <button
                        className="action-btn primary"
                        onClick={() => setIsEditing(true)}
                    >
                        Edit User
                    </button>
                )}
            </div>
        </div>
    );
});

// ChainAddressesEditor Component
const ChainAddressesEditor = React.memo(function ChainAddressesEditor({ addresses, onChange }) {
    const [newChain, setNewChain] = useState('');
    const [newAddress, setNewAddress] = useState('');

    const addAddress = () => {
        if (newChain.trim() && newAddress.trim()) {
            onChange({
                ...addresses,
                [newChain.trim()]: newAddress.trim()
            });
            setNewChain('');
            setNewAddress('');
        }
    };

    const removeAddress = (chain) => {
        const updated = { ...addresses };
        delete updated[chain];
        onChange(updated);
    };

    return (
        <div className="chain-editor">
            <div className="addresses-list">
                {Object.entries(addresses).map(([chain, address]) => (
                    <div key={chain} className="address-edit-item">
                        <input
                            type="text"
                            value={chain}
                            onChange={(e) => {
                                const updated = { ...addresses };
                                delete updated[chain];
                                updated[e.target.value] = address;
                                onChange(updated);
                            }}
                            className="chain-input"
                            placeholder="Chain name"
                        />
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => onChange({...addresses, [chain]: e.target.value})}
                            className="address-input mono"
                            placeholder="Address"
                        />
                        <button
                            className="remove-btn"
                            onClick={() => removeAddress(chain)}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
            
            <div className="add-address-form">
                <input
                    type="text"
                    value={newChain}
                    onChange={(e) => setNewChain(e.target.value)}
                    placeholder="Chain (e.g., ethereum)"
                    className="chain-input"
                />
                <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Address"
                    className="address-input mono"
                />
                <button
                    onClick={addAddress}
                    className="add-btn"
                    disabled={!newChain.trim() || !newAddress.trim()}
                >
                    + Add
                </button>
            </div>
        </div>
    );
});

// AddUserModal Component
const AddUserModal = React.memo(function AddUserModal({ onClose, onSave, loading }) {
    const [formData, setFormData] = useState({
        wallet_address: '',
        email: '',
        username: '',
        is_verified_by_coinbase: false,
        chain_addresses: {}
    });

    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};
        if (!formData.wallet_address) {
            newErrors.wallet_address = 'Wallet address is required';
        } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.wallet_address)) {
            newErrors.wallet_address = 'Invalid Ethereum address';
        }
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) {
            onSave(formData);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Add New User</h3>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Wallet Address *</label>
                        <input
                            type="text"
                            value={formData.wallet_address}
                            onChange={(e) => setFormData({...formData, wallet_address: e.target.value})}
                            className={`mono ${errors.wallet_address ? 'error' : ''}`}
                            placeholder="0x..."
                        />
                        {errors.wallet_address && (
                            <div className="error-message">{errors.wallet_address}</div>
                        )}
                    </div>
                    
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className={errors.email ? 'error' : ''}
                            placeholder="user@example.com"
                        />
                        {errors.email && (
                            <div className="error-message">{errors.email}</div>
                        )}
                    </div>
                    
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            placeholder="username"
                        />
                    </div>
                    
                    <div className="form-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.is_verified_by_coinbase}
                                onChange={(e) => setFormData({...formData, is_verified_by_coinbase: e.target.checked})}
                            />
                            Coinbase Verified
                        </label>
                    </div>
                    
                    <div className="modal-actions">
                        <button
                            type="button"
                            onClick={onClose}
                            className="action-btn secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="action-btn success"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
});

export default AdminUserManager;