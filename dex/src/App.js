import "./App.css";
import { useEffect, useState } from "react";
import { Header, Footer } from "./components";
import { Home, Tokens, Admin, TokenDetails, Cryptocurrencies, CryptoDetails, Swap, Account } from "./pages";
import AccoutSettings from "./components/Account/AccoutSettings";
import { ChainProvider } from './contexts/ChainContext';
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";
import { useUserCrud } from "./hooks";

function App() {
  const { address, isConnected }= useAccount();
  const {disconnect} = useDisconnect()
  const navigate = useNavigate();
  const { createUser, getUserByWallet } = useUserCrud();
  const [showSetupPrompt, setShowSetupPrompt] = useState(false);


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
        const created = await createUser({ wallet_address: address });
        user = created.success ? created.data : null;
      }

      if (!isMounted) return;

      const isComplete = Boolean(user?.email && user?.username && user?.is_verified_by_coinbase);
      setShowSetupPrompt(!isComplete);
    };

    ensureUser();

    return () => {
      isMounted = false;
    };
  }, [address, createUser, getUserByWallet]);

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
        <Route exact path="coins/:name?/:uuid?" element={<CryptoDetails address={address} />} />
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
 