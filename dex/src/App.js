import "./App.css";
import { Header, Footer } from "./components";
import { Home, Tokens, Admin, TokenDetails, Cryptocurrencies, CryptoDetails, Swap, Account } from "./pages";
import { ChainProvider } from './contexts/ChainContext';
import { Routes, Route } from "react-router-dom";
import { useAccount, useDisconnect } from "wagmi";

function App() {
  const { address, isConnected }= useAccount();
  const {disconnect} = useDisconnect()


  return <div className="App">
    <ChainProvider>
      <Header isConnect={isConnected} address={address} disconnect={disconnect} />
      <div className="mainWindow">
      <Routes>
        <Route exact path="/" element={<Home />} />
        <Route path="/tokens" element={<Tokens address={address} />} />
        <Route path="/admin" element={<Admin />} /> 
        <Route path="/cryptocurrencies" element={<Cryptocurrencies />} /> 
        <Route path="/account" element={<Account isConnect={isConnected} address={address} />} />   
        <Route path="/swap" element={<Swap isConnect={isConnected} address={address}/>} />
        <Route exact path="/:name?/:uuid?" element={<TokenDetails address={address} />} />
        <Route exact path="coins/:name?/:uuid?" element={<CryptoDetails address={address} />} />
      </Routes>
    </div>
    <Footer className="mainWindow"/>
    </ChainProvider>
  </div>;
}

export default App;
 