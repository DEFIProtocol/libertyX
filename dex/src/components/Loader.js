import React from 'react';
import './LoadingScreen.css';

const LoadingScreen = ({ 
  isLoading = true,
  message = "Loading",
  size = "medium"
}) => {
  if (!isLoading) return null;

  return (
    <div className={`loading-screen ${size}`}>
      <div className="logo-part part-1"></div>
      <div className="logo-part part-2"></div>
      <div className="logo-part part-3"></div>
      <div className="logo-part part-4"></div>
      <div className="logo-part part-5"></div>
      
      <div className="loading-text">{message}</div>
    </div>
  );
};

export default LoadingScreen;