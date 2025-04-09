import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import Navbar from '@/components/layout/Navbar';
import SubaccountGrid from '@/components/subaccounts/SubaccountGrid';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';
import useStore from '@/store/useStore';
import { Wallet, LineChart, LayoutGrid, Search } from 'lucide-react';
import { getSubaccounts, getDriftClient } from '@/services/drift';
import { PublicKey } from '@solana/web3.js';
import { Subaccount } from '@/types/drift';

// Market names mapping
const MARKET_NAMES = {
  0: "SOL-PERP",
  1: "BTC-PERP",
  2: "ETH-PERP",
  3: "MATIC-PERP",
  4: "BNB-PERP",
  5: "AVAX-PERP",
  6: "ARB-PERP",
  7: "APT-PERP",
};

const SPOT_MARKET_NAMES = {
  0: "USDC",
  1: "SOL",
  2: "ETH",
  3: "BTC",
  4: "BONK",
  5: "JTO",
  6: "JUP",
  7: "MATIC",
};

const Dashboard: React.FC = () => {
  const { 
    setLoading, 
    loading,
    setSubaccounts, 
    walletMode, 
    readonlyWalletAddress, 
    setWalletMode, 
    setReadonlyWalletAddress, 
    subaccounts 
  } = useStore();
  const { publicKey, connected } = useWallet();
  const [searchInput, setSearchInput] = useState(readonlyWalletAddress || '');
  const [error, setError] = useState('');

  // Format number with commas and proper decimal places
  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const clearSearch = () => {
    setSearchInput('');
    setError('');
    if (walletMode === 'readonly') {
      setSubaccounts([]);
      setWalletMode('disconnected');
      setReadonlyWalletAddress('');
    }
  };

  useEffect(() => {
    if(subaccounts.length > 0 && walletMode === 'readonly') return;
    if (connected && publicKey) {
      setLoading(true);
      setWalletMode('connected');
      getData(publicKey.toString());
    } 
  }, [connected, publicKey]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      // Validate Solana address
      new PublicKey(searchInput);
      
      setLoading(true);
      setWalletMode('readonly');
      setReadonlyWalletAddress(searchInput);
      await getData(searchInput);
    } catch (error) {
      setError('Invalid Solana address');
      console.error("Search error:", error);
    }
  };

  async function getData(walletAddress: string) {
    try {
      const subaccounts = await getSubaccounts(walletAddress);
      console.log("Raw Subaccounts:", subaccounts);
      
      const processedSubaccounts = await Promise.all(subaccounts.map(async (account, index) => {
        // Calculate total value from spot positions
        const totalSpotValue = account.spotBalances.reduce((total, spot) => total + spot.value, 0);

        return {
          index,
          totalValue: Number(totalSpotValue.toFixed(2)),
          spotBalances: account.spotBalances,
          positions: account.perpPositions.map((position, marketIndex) => {
            // Only include positions with some size
            if (position.baseAssetAmount.isZero()) return null;

            const market = MARKET_NAMES[marketIndex] || `Market ${marketIndex}`; // Use market name or fallback
            const size = position.baseAssetAmount.toNumber() / 1e9; // Convert to standard units
            const entryPrice = Math.abs(position.quoteEntryAmount.toNumber()) / Math.abs(position.baseAssetAmount.toNumber());
            const pnl = position.settledPnl.toNumber() / 1e6;
            const quoteAmount = Math.abs(position.quoteAssetAmount.toNumber()) / 1e6;
            
            const leverage = quoteAmount !== 0
              ? Math.abs(size * entryPrice) / quoteAmount
              : 0;

            const direction : "long" | "short" = size > 0 ? 'long' : 'short';
            
            return {
              market,
              direction,
              size: Number(size.toFixed(4)),
              leverage: Number(leverage.toFixed(2)),
              entryPrice: Number(entryPrice.toFixed(2)),
              pnl: Number(pnl.toFixed(2)),
            };
          }).filter(Boolean), // Remove nulls
          openOrders: [],
          pnl: Number((account.settledPerpPnl.toNumber() / 1e6).toFixed(2)),
        };
      }));
      
      setSubaccounts(processedSubaccounts);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching subaccounts:", error);
      setSubaccounts([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container-padding mx-auto py-8 max-w-7xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold">Subaccounts</h2>
          </div>
          <p className="text-muted-foreground max-w-2xl mb-4">
            {connected 
              ? "View, manage, and monitor your Drift Protocol subaccounts. Each subaccount allows isolated positions and separate margin accounts."
              : "Connect your wallet or search for an address to view Drift Protocol subaccounts."}
          </p>
          
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by wallet address..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={loading}
                />
                {loading ? (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !searchInput}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
        
        <div className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-5 flex items-center gap-4">
            <div className="bg-primary/10 text-primary rounded-full p-3">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Total Value</h3>
              {loading ? (
                <div className="h-8 w-32 bg-muted/20 animate-pulse rounded"></div>
              ) : (
                <p className="text-2xl font-bold">
                  ${formatNumber(subaccounts?.reduce((acc, subaccount) => acc + subaccount.totalValue, 0) || 0)}
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-5 flex items-center gap-4">
            <div className="bg-emerald-500/10 text-emerald-400 rounded-full p-3">
              <LineChart className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Active Positions</h3>
              {loading ? (
                <div className="h-8 w-16 bg-muted/20 animate-pulse rounded"></div>
              ) : (
                <p className="text-2xl font-bold">
                  {formatNumber(subaccounts?.reduce((acc, subaccount) => acc + subaccount.positions.length, 0) || 0, 0)}
                </p>
              )}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-sm border border-primary/20 rounded-lg p-5">
            <h3 className="text-sm font-medium text-primary-foreground/70 mb-1">Drift Protocol</h3>
            <p className="text-xl font-semibold mb-2">Perpetual Futures & Spot</p>
            <p className="text-sm text-muted-foreground">
              Trade with up to 10x leverage on Solana
            </p>
          </div>
        </div>
        
        <SubaccountGrid loading={loading} />
      </main>
      
      {/* Modals */}
      <DepositModal />
      <WithdrawModal />
    </div>
  );
};

export default Dashboard;
