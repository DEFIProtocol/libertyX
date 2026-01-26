// components/AdminAccess.jsx
import { useState } from 'react';
import './AdminAccess.css';

function AdminAccess({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Hardcoded for now
  const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'admin123';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('adminAuthenticated', 'true');
      onLogin(); // Call parent function
      setPassword('');
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-login-card">
        <h1 className="admin-title">Admin Access</h1>
        <p className="admin-subtitle">Enter password to continue</p>
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="Enter admin password"
              autoComplete="current-password"
            />
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <button type="submit" className="login-button">
            Login
          </button>
        </form>
        
        <div className="admin-hint">
          <small>Hint: Check your .env file for ADMIN_PASSWORD</small>
        </div>
      </div>
    </div>
  );
}

export default AdminAccess;