// components/AdminDashboard.jsx
import './AdminAccess.css'; // Same CSS file
import AdminTokenManager from './AdminTokenManager';

function AdminDashboard({ onLogout }) {
  return (
    <div className="admin-container">
      <div className="admin-dashboard">
        <div className="admin-header">
          <h1 className="admin-title">Admin Dashboard</h1>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
        
        <div className="admin-content">
          <div className="admin-card">
            <AdminTokenManager />
          </div>
          
          <div className="admin-card">
            <h2 className="card-title">Database Status</h2>
            <p className="card-description">
              Check your PostgreSQL database connection and token counts.
            </p>
            <div className="coming-soon">
              <span>📊 Coming Soon</span>
            </div>
          </div>
          
          <div className="admin-card">
            <h2 className="card-title">JSON File Import</h2>
            <p className="card-description">
              Import your tokens_smart_consolidated.json file to update the database.
            </p>
            <div className="coming-soon">
              <span>📁 Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;