import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { configureChains, WagmiConfig, createClient } from "wagmi";
import { mainnet, polygon, arbitrum, bsc, avalanche } from 'wagmi/chains';
import { publicProvider } from "wagmi/providers/public";
import { AppProvider } from "./contexts/AppProvider"; // Single import!

const { provider, webSocketProvider } = configureChains(
  [mainnet, polygon, arbitrum, bsc, avalanche],
  [publicProvider()]
);

const client = createClient({
  autoConnect: true,
  provider,
  webSocketProvider,
})

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <WagmiConfig client={client}>
      <BrowserRouter>
        <AppProvider>  
          <App />
        </AppProvider>
      </BrowserRouter>
    </WagmiConfig>
  </React.StrictMode>
);