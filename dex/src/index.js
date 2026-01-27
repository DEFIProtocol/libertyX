// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { configureChains, WagmiConfig, createClient } from "wagmi";
import { mainnet, polygon, arbitrum, bsc, avalanche } from 'wagmi/chains';
import { publicProvider } from "wagmi/providers/public";
import { AppProvider } from "./contexts/AppProvider";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { provider, webSocketProvider } = configureChains(
  [mainnet, polygon, arbitrum, bsc, avalanche],
  [publicProvider()]
);

const client = createClient({
  autoConnect: true,
  provider,
  webSocketProvider,
});

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <WagmiConfig client={client}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AppProvider>  
            <App />
          </AppProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </WagmiConfig>
  </React.StrictMode>
);