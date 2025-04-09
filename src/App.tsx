import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { WalletProvider } from './components/WalletProvider';
import Dashboard from "./pages/Dashboard";
import SubaccountDetail from "./pages/SubaccountDetail";
import NotFound from "./pages/NotFound";
import Navbar from "./components/layout/Navbar";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalletProvider>
          <Router>
            <div className="min-h-screen bg-background text-foreground">
              <main>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/subaccount/:index" element={<SubaccountDetail />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Toaster />
              <Sonner />
            </div>
          </Router>
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
