// pages/Admin.jsx
import { useState, useEffect } from 'react';
import AdminAccess from '../components/Admin/AdminAccess';
import AdminDashboard from '../components/Admin/AdminDashboard';

function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if already logged in
    if (localStorage.getItem('adminAuthenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminAuthenticated');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <AdminAccess onLogin={handleLogin} />;
  }

  return <AdminDashboard onLogout={handleLogout} />;
}

export default Admin;