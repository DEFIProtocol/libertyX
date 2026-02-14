// ThemeContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Initialize theme from localStorage, default to dark (false = dark mode)
  const [themeLight, setThemeLight] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'light'; // Returns true if light mode, false if dark
  });

  // Apply theme class to html element whenever theme changes
  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', themeLight);
    localStorage.setItem('theme', themeLight ? 'light' : 'dark');
  }, [themeLight]);

  const toggleTheme = () => {
    setThemeLight(prev => !prev);
  };

  // For direct setting if needed
  const setTheme = (isLight) => {
    setThemeLight(isLight);
  };

  return (
    <ThemeContext.Provider value={{ 
      themeLight, 
      toggleTheme,
      setTheme,
      // Helper to get TradingView theme string
      tradingViewTheme: themeLight ? 'light' : 'dark'
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}