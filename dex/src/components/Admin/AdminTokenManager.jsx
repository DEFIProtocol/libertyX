import { useState } from 'react';
import { useTokens } from '../../contexts/TokenContext'; 
import './AdminTokenManager.css';

function AdminTokenManager() {
  const { tokens, loading } = useTokens();
  const [selectedTokens, setSelectedTokens] = useState([]);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'duplicates', 'byChain'
  const [editingToken, setEditingToken] = useState(null);

  // Get tokens grouped by symbol for comparison
  const getTokensBySymbol = () => {
    const groups = {};
    tokens.forEach(token => {
      if (!groups[token.symbol]) {
        groups[token.symbol] = [];
      }
      groups[token.symbol].push(token);
    });
    return groups;
  };

  // Get duplicate symbols (where same symbol appears multiple times)
  const getDuplicateSymbols = () => {
    const groups = getTokensBySymbol();
    return Object.entries(groups)
      .filter(([symbol, tokenList]) => tokenList.length > 1)
      .map(([symbol, tokenList]) => ({ symbol, tokens: tokenList }));
  };

  // Filter tokens based on view mode
  const getFilteredTokens = () => {
    switch(viewMode) {
      case 'duplicates':
        return getDuplicateSymbols().flatMap(group => group.tokens);
      case 'byChain':
        // Group by chain - we'll implement this in the table
        return tokens;
      default:
        return tokens;
    }
  };

  // Toggle token selection for comparison
  const toggleTokenSelection = (token) => {
    setSelectedTokens(prev => {
      const exists = prev.some(t => t.id === token.id);
      if (exists) {
        return prev.filter(t => t.id !== token.id);
      } else {
        return [...prev, token];
      }
    });
  };

  // Start editing a token
  const startEditing = (token) => {
    setEditingToken({ ...token });
  };

  // Save edited token
  const saveEdit = async () => {
    if (!editingToken) return;
    
    // Call your backend API to update
    try {
      const response = await fetch(`http://localhost:3001/api/admin/tokens/${editingToken.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify(editingToken)
      });
      
      if (response.ok) {
        setEditingToken(null);
        // TokenContext will refresh on next fetch
      }
    } catch (error) {
      console.error('Failed to update token:', error);
    }
  };

  // Delete token
  const deleteToken = async (tokenId, tokenSymbol) => {
    if (!window.confirm(`Are you sure you want to delete ${tokenSymbol}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`http://localhost:3001/api/admin/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (response.ok) {
        // TokenContext will refresh on next fetch
        setSelectedTokens(prev => prev.filter(t => t.id !== tokenId));
      }
    } catch (error) {
      console.error('Failed to delete token:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading tokens...</div>;
  }

  return (
    <div className="admin-token-manager">
      {/* Header with controls */}
      <div className="manager-header">
        <h2>Token Management</h2>
        <div className="controls">
          <select 
            value={viewMode} 
            onChange={(e) => setViewMode(e.target.value)}
            className="view-select"
          >
            <option value="all">All Tokens</option>
            <option value="duplicates">Duplicate Symbols</option>
            <option value="byChain">Group by Chain</option>
          </select>
          
          <div className="selection-info">
            {selectedTokens.length} token(s) selected for comparison
          </div>
        </div>
      </div>

      {/* Split view: Comparison Panel on left, Main Table on right */}
      <div className="split-view">
        {/* Left: Comparison Panel */}
        <div className="comparison-panel">
          <h3>Comparison Panel</h3>
          {selectedTokens.length === 0 ? (
            <div className="empty-comparison">
              Select tokens from the table to compare them side-by-side
            </div>
          ) : (
            <div className="comparison-grid">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    {selectedTokens.map(token => (
                      <th key={token.id}>{token.symbol}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Symbol</td>
                    {selectedTokens.map(token => (
                      <td key={token.id}>{token.symbol}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Name</td>
                    {selectedTokens.map(token => (
                      <td key={token.id}>{token.name}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Decimals</td>
                    {selectedTokens.map(token => (
                      <td key={token.id}>{token.decimals}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Chains</td>
                    {selectedTokens.map(token => (
                      <td key={token.id}>
                        {token.addresses ? Object.keys(token.addresses).join(', ') : 'None'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Main Token Table */}
        <div className="main-table-panel">
          <TokenTable 
            tokens={getFilteredTokens()}
            selectedTokens={selectedTokens}
            onSelectToken={toggleTokenSelection}
            onEditToken={startEditing}
            onDeleteToken={deleteToken}
            viewMode={viewMode}
            getDuplicateSymbols={getDuplicateSymbols}
          />
        </div>
      </div>

      {/* Edit Modal (when editingToken is set) */}
      {editingToken && (
        <EditTokenModal
          token={editingToken}
          onSave={saveEdit}
          onCancel={() => setEditingToken(null)}
          onChange={(updates) => setEditingToken({ ...editingToken, ...updates })}
        />
      )}
    </div>
  );
}

// Sub-component: Token Table
function TokenTable({ tokens, selectedTokens, onSelectToken, onEditToken, onDeleteToken, viewMode, getDuplicateSymbols }) {
  // If viewing duplicates, show grouped
  if (viewMode === 'duplicates') {
    const duplicateGroups = getDuplicateSymbols();
    
    return (
      <div className="duplicate-groups">
        {duplicateGroups.map(group => (
          <div key={group.symbol} className="duplicate-group">
            <h4 className="group-header">{group.symbol} ({group.tokens.length} instances)</h4>
            <table className="token-table">
              <thead>
                <tr>
                  <th></th>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Chains</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.tokens.map(token => (
                  <TokenRow
                    key={token.id}
                    token={token}
                    isSelected={selectedTokens.some(t => t.id === token.id)}
                    onSelect={() => onSelectToken(token)}
                    onEdit={() => onEditToken(token)}
                    onDelete={() => onDeleteToken(token.id, token.symbol)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  // Normal table view
  return (
    <table className="token-table">
      <thead>
        <tr>
          <th></th>
          <th>Symbol</th>
          <th>Name</th>
          <th>Decimals</th>
          <th>Chains</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map(token => (
          <TokenRow
            key={token.id}
            token={token}
            isSelected={selectedTokens.some(t => t.id === token.id)}
            onSelect={() => onSelectToken(token)}
            onEdit={() => onEditToken(token)}
            onDelete={() => onDeleteToken(token.id, token.symbol)}
          />
        ))}
      </tbody>
    </table>
  );
}

// Sub-component: Token Row
function TokenRow({ token, isSelected, onSelect, onEdit, onDelete }) {
  return (
    <tr className={isSelected ? 'selected' : ''}>
      <td>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
        />
      </td>
      <td className="symbol-cell">
        <strong>{token.symbol}</strong>
        {token.image && (
          <img src={token.image} alt={token.symbol} className="token-icon" />
        )}
      </td>
      <td>{token.name}</td>
      <td>{token.decimals}</td>
      <td>
        {token.addresses ? (
          <div className="chain-badges">
            {Object.keys(token.addresses).map(chain => (
              <span key={chain} className="chain-badge">{chain}</span>
            ))}
          </div>
        ) : 'None'}
      </td>
      <td className="actions-cell">
        <button onClick={onEdit} className="edit-btn">Edit</button>
        <button onClick={onDelete} className="delete-btn">Delete</button>
      </td>
    </tr>
  );
}

// Sub-component: Edit Modal
function EditTokenModal({ token, onSave, onCancel, onChange }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Edit Token: {token.symbol}</h3>
        
        <div className="form-group">
          <label>Symbol</label>
          <input
            value={token.symbol}
            onChange={(e) => onChange({ symbol: e.target.value })}
          />
        </div>
        
        <div className="form-group">
          <label>Name</label>
          <input
            value={token.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        
        <div className="form-group">
          <label>Decimals</label>
          <input
            type="number"
            value={token.decimals}
            onChange={(e) => onChange({ decimals: parseInt(e.target.value) })}
          />
        </div>
        
        {/* Add more fields as needed */}
        
        <div className="modal-actions">
          <button onClick={onSave} className="save-btn">Save</button>
          <button onClick={onCancel} className="cancel-btn">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default AdminTokenManager;