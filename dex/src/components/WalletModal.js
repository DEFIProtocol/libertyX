import React, { useState, useEffect, useContext } from 'react';
import { useConnect, useNetwork, useSwitchNetwork } from 'wagmi';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { mainnet, polygon, arbitrum, bsc, avalanche } from 'wagmi/chains';
import ChainContext from '../contexts/ChainContext';

function WalletModal({ isOpen, onClose }) {
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect();
  const { chain } = useNetwork();
  const { switchNetwork, error: switchError } = useSwitchNetwork();

  const { selected, setSelected, availableChains } = useContext(ChainContext);
  const [selectedLocal, setSelectedLocal] = useState(selected);
  const [solanaAddress, setSolanaAddress] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSolanaAddress(null);
    setSelectedLocal(selected);
  }, [isOpen, selected]);

  if (!isOpen) return null;

  const connectEVM = async (connector) => {
    try {
      await connect({ connector, chainId: selectedLocal.id });
      if (switchNetwork && chain?.id !== selectedLocal.id) {
        try { switchNetwork(selectedLocal.id); } catch (e) { }
      }
      // persist selection globally
      try { setSelected(selectedLocal); } catch (e) { }
      onClose();
    } catch (e) {
      console.error('connectEVM error', e);
    }
  }

  const handleMetaMask = async () => {
    connectEVM(new MetaMaskConnector({ chains: [selectedLocal] }));
  }

  const handleInjected = async () => {
    connectEVM(new InjectedConnector({ chains: [selectedLocal] }));
  }

  const handleCoinbase = async () => {
    connectEVM(new CoinbaseWalletConnector({ options: { appName: 'DexStarter' }, chains: [selectedLocal] }));
  }

  const handleWalletConnect = async () => {
    connectEVM(new WalletConnectConnector({ options: { qrcode: true }, chains: [selectedLocal] }));
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
            {availableChains.map(c => (
              <button key={c.key} onClick={() => setSelectedLocal(c.chain)} className="walletOption" style={{ padding: '8px 10px', borderRadius: 10, borderLeft: selectedLocal.id === c.chain.id ? '4px solid var(--accent)' : '4px solid transparent' }}>
                {c.label}
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
