import React, {useState, useEffect, useContext} from 'react';
import Eth from "../eth.svg";
import {Link} from "react-router-dom";
import { MenuOutlined } from '@ant-design/icons';
import OutlinedLogo from "../OutlinedLogo.png"
import WalletModal from './WalletModal';
import ChainContext from '../contexts/ChainContext';


function Header(props) {
  const { address, disconnect, isConnect } = props;
  const [themeLight, setThemeLight] = useState(false);
  const [activeMenu, setActiveMenu ] = useState(true);
  const [ isOpen, setIsOpen] = useState(false);
  const [screenSize, setScreenSize] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { selected, setSelected, availableChains: available } = useContext(ChainContext);

  useEffect(() => {
    const handleResize = () => setScreenSize(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize()
  },[])

  useEffect (() => {
    if(screenSize < 760) {
        setActiveMenu(false);
    } else {
        setActiveMenu(true);
    }
  }, [screenSize])

  useEffect(() => {
    const pref = localStorage.getItem('theme') === 'light';
    setThemeLight(pref);
    if (pref) document.documentElement.classList.add('theme-light');
  }, [])

  const toggleTheme = () => {
    const next = !themeLight;
    setThemeLight(next);
    if (next) {
      document.documentElement.classList.add('theme-light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('theme-light');
      localStorage.setItem('theme', 'dark');
    }
  }


  return (
    <header className="header-page">
      <div className="leftH">
        {activeMenu === false  ? 
        <MenuOutlined className="acitve-menu" onClick = {isOpen === false ? () => setIsOpen(true) : () => setIsOpen(false)}></MenuOutlined>
        : null
        }
        <Link to ="/" className="link">
          <div className="gridLock">
          <img className="logoGRL" src={OutlinedLogo} alt="noLogo" />
          {/*
            <div className="grid">grid</div>
          <div className="lock">Lock</div> */
          }
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
          <img src={Eth} alt="eth" className ="eth" />
          {!activeMenu ? "Eth" : (
            <select className="chainSelect" value={(available.find(c => c.chain.id === selected.id) || {}).key || 'ethereum'} onChange={(e) => {
              const found = available.find(c => c.key === e.target.value);
              if (found) setSelected(found.chain);
            }}>
              {available.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          )}
        </div>
        <button className="themeToggle" onClick={toggleTheme} aria-label="Toggle theme">{themeLight ? '🌞' : '🌙'}</button>
        <div className="connectButton" onClick={!isConnect ? () => setShowWalletModal(true) : disconnect}>
          {address ? (address.slice(0,5) +"..."+address.slice(38)) : "Connect"}
        </div>
      </div>
      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </header>
  )
}

export default Header
