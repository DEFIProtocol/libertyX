import React, { useState, useEffect } from 'react';
import Eth from "../eth.svg";
import {Link} from "react-router-dom";
import { MenuOutlined } from '@ant-design/icons';
import OutlinedLogo from "../OutlinedLogo.png"
import WalletModal from './WalletModal';
import { useChainContext } from '../contexts/ChainContext';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme

function Header(props) {
  const { address, disconnect, isConnect } = props;
  const { themeLight, toggleTheme } = useTheme(); // Use theme context
  const [activeMenu, setActiveMenu] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [screenSize, setScreenSize] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { selectedChain, setSelectedChain, availableChains, getChainLabel } = useChainContext();

  useEffect(() => {
    const handleResize = () => setScreenSize(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (screenSize < 760) {
      setActiveMenu(false);
    } else {
      setActiveMenu(true);
    }
  }, [screenSize]);

  return (
    <header className="header-page">
      <div className="leftH">
        {activeMenu === false ? 
          <MenuOutlined className="acitve-menu" onClick={isOpen === false ? () => setIsOpen(true) : () => setIsOpen(false)} />
          : null
        }
        <Link to="/" className="link">
          <div className="gridLock">
            <img className="logoGRL" src={OutlinedLogo} alt="noLogo" />
          </div>
        </Link>
        {!activeMenu && isOpen ? (
          <div className="navOverlay" onClick={() => setIsOpen(false)}>
            <div className="navWindow" onClick={(e) => e.stopPropagation()}>
              <div className="navHeader">
                <img className="logoGRL" src={OutlinedLogo} alt="logo" />
                <div className="navClose" onClick={() => setIsOpen(false)}>✕</div>
              </div>
              <div className="navList">
                {!isConnect ? null : 
                  <Link to="/account" className="navItem link" onClick={() => setIsOpen(false)}>Account</Link>
                }
                <Link to="/cryptocurrencies" className="navItem link" onClick={() => setIsOpen(false)}>Coins</Link>
                <Link to="/tokens" className="navItem link" onClick={() => setIsOpen(false)}>Tokens</Link>
                <Link to="/swap" className="navItem link" onClick={() => setIsOpen(false)}>Swap</Link>
              </div>
            </div>
          </div>
        ) : activeMenu ?
          <div className="header-items-container2">
            {!isConnect ? null : 
              <Link to="/account" className="link">
                <div className="headerItem">Account</div>
              </Link>
            }
            <Link to="/cryptocurrencies" className="link">
              <div className="headerItem">Coins</div>
            </Link>
            <Link to="/tokens" className="link">
              <div className="headerItem">Tokens</div>
            </Link>
            <Link to="/swap" className="link">
              <div className="headerItem">Swap</div>
            </Link>
          </div> : null}
      </div>
      <div className="rightH">
        <div className="headerItem">
          <img src={Eth} alt="eth" className="eth" />
          {!activeMenu ? (getChainLabel?.(selectedChain) || 'Chain') : (
            <select 
              className="chainSelect" 
              value={selectedChain} 
              onChange={(e) => setSelectedChain(e.target.value)}
            >
              {availableChains.map(chain => (
                <option key={chain.id} value={chain.id}>
                  {chain.label}
                </option>
              ))}
            </select>
          )}
        </div>
        <button className="themeToggle" onClick={toggleTheme} aria-label="Toggle theme">
          {themeLight ? '🌞' : '🌙'}
        </button>
        <div className="connectButton" onClick={!isConnect ? () => setShowWalletModal(true) : disconnect}>
          {address ? (address.slice(0,5) + "..." + address.slice(38)) : "Connect"}
        </div>
      </div>
      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </header>
  );
}

export default Header;