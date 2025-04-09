import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider } from '@solana/wallet-adapter-react';
import { WalletProvider } from '@solana/wallet-adapter-react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Connection, ConnectionConfig } from '@solana/web3.js';
import Dashboard from "./pages/Dashboard";
import SubaccountDetail from "./pages/SubaccountDetail";
import NotFound from "./pages/NotFound";
import { WalletContextProvider } from './components/WalletProvider';
import Navbar from "./components/layout/Navbar";

// Import styles
import './App.css';
import './styles/wallet.css';

const queryClient = new QueryClient();

const App = () => {
  // Use Helius RPC endpoint for better reliability
  const endpoint = 'https://rpc.helius.xyz/?api-key=1aec2a6d-3898-4857-b0e4-2d7af1d4f29e';
  const config: ConnectionConfig = {
    commitment: 'confirmed',
    wsEndpoint: 'wss://rpc.helius.xyz/?api-key=1aec2a6d-3898-4857-b0e4-2d7af1d4f29e',
    confirmTransactionInitialTimeout: 120000, // 2 minutes
  };

  return (
    <WalletContextProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConnectionProvider endpoint={endpoint} config={config}>
            <WalletProvider wallets={[]} autoConnect>
              <BrowserRouter>
                <div className="min-h-screen bg-background text-foreground">
                  {/* <Navbar /> */}
                  <main>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/subaccount/:id" element={<SubaccountDetail />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                  <Toaster />
                  <Sonner />
                </div>
              </BrowserRouter>
            </WalletProvider>
          </ConnectionProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </WalletContextProvider>
  );
};

export default App;
