import React, { useState, useEffect } from 'react';
import { useConnect, useNetwork, useSwitchNetwork } from 'wagmi';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { useChainContext } from '../contexts/ChainContext';

function WalletModal({ isOpen, onClose }) {
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect();
  const { chain } = useNetwork();
  const { switchNetwork, error: switchError } = useSwitchNetwork();

  // ✅ Use the custom hook
  const { selectedChain, setSelectedChain, availableChains } = useChainContext();
  
  const [selectedLocal, setSelectedLocal] = useState(selectedChain);
  const [solanaAddress, setSolanaAddress] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSolanaAddress(null);
    setSelectedLocal(selectedChain);
  }, [isOpen, selectedChain]);

  if (!isOpen) return null;

  const connectEVM = async (connector) => {
    try {
      // Since we're using string chain names, we need to convert to chain ID
      // You might need to adjust this based on your chain data structure
      const chainMap = {
        'ethereum': 1,
        'polygon': 137,
        'arbitrum': 42161,
        'bsc': 56,
        'avalanche': 43114
      };
      
      const chainId = chainMap[selectedLocal] || 1; // Default to Ethereum
      
      await connect({ connector, chainId });
      
      // Optionally switch network if needed
      if (switchNetwork && chain?.id !== chainId) {
        try { switchNetwork(chainId); } catch (e) { }
      }
      
      // Update global chain selection
      try { setSelectedChain(selectedLocal); } catch (e) { }
      onClose();
    } catch (e) {
      console.error('connectEVM error', e);
    }
  }

  const handleMetaMask = async () => {
    connectEVM(new MetaMaskConnector());
  }

  const handleInjected = async () => {
    connectEVM(new InjectedConnector());
  }

  const handleCoinbase = async () => {
    connectEVM(new CoinbaseWalletConnector({ options: { appName: 'DexStarter' } }));
  }

  const handleWalletConnect = async () => {
    connectEVM(new WalletConnectConnector({ options: { qrcode: true } }));
  }

  const handleSolana = async () => {
    try {
      const provider = window.solana;
      if (provider && provider.isPhantom) {
        const resp = await provider.connect();
        setSolanaAddress(resp.publicKey.toString());
        localStorage.setItem('solanaAddress', resp.publicKey.toString());
        onClose();
      } else {
        alert('No Solana wallet detected. Install Phantom or a compatible wallet.');
      }
    } catch (e) {
      console.error('Solana connect error', e);
    }
  }

  return (
    <div className="modalOverlay">
      <div className="modalWindow">
        <div className="modalHeader">
          <h3>Connect Wallet</h3>
          <button className="closeButton" onClick={onClose}>X</button>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Select chain</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {availableChains.map(chain => (
              <button 
                key={chain} 
                onClick={() => setSelectedLocal(chain)} 
                className="walletOption" 
                style={{ 
                  padding: '8px 10px', 
                  borderRadius: 10, 
                  borderLeft: selectedLocal === chain ? '4px solid var(--accent)' : '4px solid transparent' 
                }}
              >
                {chain.charAt(0).toUpperCase() + chain.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="modalBody">
          <button className="walletOption" onClick={handleMetaMask}>MetaMask</button>
          <button className="walletOption" onClick={handleCoinbase}>Coinbase Wallet</button>
          <button className="walletOption" onClick={handleWalletConnect}>WalletConnect</button>
          <button className="walletOption" onClick={handleInjected}>Integrate Browser Wallet</button>
          <div style={{ height: 8 }} />
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Non-EVM</div>
          <button className="walletOption" onClick={handleSolana}>Solana (Phantom)</button>
        </div>

        {error && <div className="modalError">Error: {error.message}</div>}
        {switchError && <div className="modalError">Switch error: {switchError.message}</div>}
      </div>
    </div>
  )
}

export default WalletModal;