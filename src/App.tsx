import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
  return (
    <WalletContextProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
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
        </TooltipProvider>
      </QueryClientProvider>
    </WalletContextProvider>
  );
};

export default App;
