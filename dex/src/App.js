import "./App.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header, Footer } from "./components";
import { Home, Tokens, Admin, TokenDetails, Cryptocurrencies, CryptoDetails, Swap, Account } from "./pages";
import AccoutSettings from "./components/Account/AccoutSettings";
import { ChainProvider, useChainContext } from './contexts/ChainContext';
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAccount, useDisconnect, useNetwork, useSignMessage, useSwitchNetwork } from "wagmi";
import { useUserCrud } from "./hooks";

function App() {
  const { address, isConnected }= useAccount();
  const {disconnect} = useDisconnect()
  const { chain } = useNetwork();
  const { switchNetworkAsync } = useSwitchNetwork();
  const { signMessageAsync } = useSignMessage();
  const navigate = useNavigate();
  const { createUser, getUserByWallet, updateUserById } = useUserCrud();
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);
  const { selectedChain, availableChains } = useChainContext();
  const lastSignedChainRef = useRef(null);

  const resolveChainKey = useCallback((chainValue) => {
    const chainValueStr = String(chainValue || '');
    const match = availableChains.find(
      (chain) => chain.id === chainValueStr || chain.key === chainValueStr
    );
    return match?.key || chainValueStr;
  }, [availableChains]);


  useEffect(() => {
    let isMounted = true;

    const ensureUser = async () => {
      if (!address) {
        if (isMounted) setShowSetupPrompt(false);
        return;
      }

      const lookup = await getUserByWallet(address);
      let user = lookup.success ? lookup.data : null;

      if (!user && lookup.error && lookup.error.toLowerCase().includes('not found')) {
        const chainKey = resolveChainKey(selectedChain);
        const chainId = String(selectedChain || '');
        const isEthereum = chainKey === 'ethereum' || chainId === '1';
        const payload = {
          wallet_address: address,
          ...(isEthereum ? {} : { chain_addresses: { [chainId]: address } })
        };

        const created = await createUser(payload);
        user = created.success ? created.data : null;
      }

      const chainKey = resolveChainKey(selectedChain);
      const chainId = String(selectedChain || '');
      const isEthereum = chainKey === 'ethereum' || chainId === '1';
      if (user && user.id && !isEthereum) {
        const existingChains = user.chain_addresses && typeof user.chain_addresses === 'object'
          ? user.chain_addresses
          : {};
        const nextChains = { ...existingChains, [chainId]: address };

        if (existingChains[chainId] !== address) {
          const updated = await updateUserById(user.id, { chain_addresses: nextChains });
          if (updated.success) {
            user = updated.data;
          }
        }
      }

      if (!isMounted) return;

      const isComplete = Boolean(user?.email && user?.username && user?.is_verified_by_coinbase);
      setShowSetupPrompt(!isComplete);
    };

    ensureUser();

    return () => {
      isMounted = false;
    };
  }, [address, createUser, getUserByWallet, updateUserById, selectedChain, resolveChainKey]);

  useEffect(() => {
    let isMounted = true;

    const signInForChain = async () => {
      if (!isConnected || !address) return;

      const chainId = String(selectedChain || '');
      if (!chainId || lastSignedChainRef.current === chainId) return;

      if (switchNetworkAsync && (!chain || String(chain.id) !== chainId)) {
        try {
          await switchNetworkAsync(Number(chainId));
        } catch (error) {
          console.warn('wallet network switch rejected', error);
          return;
        }
      }

      try {
        await signMessageAsync({
          message: `Sign in to LibertyX\nWallet: ${address}\nChain: ${chainId}`
        });
      } catch (error) {
        console.warn('wallet signature rejected', error);
        return;
      }

      if (!isMounted) return;
      lastSignedChainRef.current = chainId;

      const lookup = await getUserByWallet(address);
      const user = lookup.success ? lookup.data : null;
      if (!user || !user.id) return;

      const chainKey = resolveChainKey(selectedChain);
      const isEthereum = chainKey === 'ethereum' || chainId === '1';
      if (isEthereum) return;

      const existingChains = user.chain_addresses && typeof user.chain_addresses === 'object'
        ? user.chain_addresses
        : {};

      if (existingChains[chainId] === address) return;

      const nextChains = { ...existingChains, [chainId]: address };
      await updateUserById(user.id, { chain_addresses: nextChains });
    };

    signInForChain();

    return () => {
      isMounted = false;
    };
  }, [address, chain, isConnected, getUserByWallet, updateUserById, resolveChainKey, selectedChain, signMessageAsync, switchNetworkAsync]);

  return <div className="App">
    <ChainProvider>
      <Header isConnect={isConnected} address={address} disconnect={disconnect} />
      <div className="mainWindow">
      <Routes>
        <Route exact path="/" element={<Home />} />
        <Route path="/tokens" element={<Tokens address={address} />} />
        <Route path="/token/:uuid" element={<TokenDetails address={address} />} />
        <Route path="/admin" element={<Admin />} /> 
        <Route path="/cryptocurrencies" element={<Cryptocurrencies />} /> 
        <Route path="/account" element={<Account isConnect={isConnected} address={address} />} />   
        <Route path="/account/settings" element={<AccoutSettings />} />
        <Route path="/swap" element={<Swap isConnect={isConnected} address={address}/>} />
        <Route exact path="/:name?/:uuid?" element={<TokenDetails address={address} />} />
        <Route exact path="coins/:uuid?" element={<CryptoDetails address={address} />} />
      </Routes>
    </div>
    <Footer className="mainWindow"/>
    {showSetupPrompt && (
      <div className="account-setup-toast">
        <div className="account-setup-content">
          <div className="account-setup-title">Complete account setup</div>
          <div className="account-setup-body">Add details to unlock funding features.</div>
          <div className="account-setup-actions">
            <button
              className="account-setup-button"
              onClick={() => navigate('/account/settings')}
            >
              Open settings
            </button>
            <button
              className="account-setup-dismiss"
              onClick={() => setShowSetupPrompt(false)}
              aria-label="Dismiss"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </ChainProvider>
  </div>;
}

export default App;
 