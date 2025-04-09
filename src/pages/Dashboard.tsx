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
import { BN } from '@drift-labs/sdk';

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
  const { publicKey, connected } = useWallet();
  const { 
    subaccounts, 
    setSubaccounts, 
    loading, 
    setLoading,
    walletMode,
    setWalletMode,
    readonlyWalletAddress,
    setReadonlyWalletAddress 
  } = useStore();
  const [searchInput, setSearchInput] = useState(readonlyWalletAddress || '');
  const [error, setError] = useState('');
  const [isValidAddress, setIsValidAddress] = useState(true);

  // Format number with commas and proper decimal places
  const formatNumber = (value: number, decimals: number = 2) => {
    // For very small numbers (less than 0.01), show more decimals
    const effectiveDecimals = Math.abs(value) < 0.01 ? 6 : decimals;
    
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: effectiveDecimals,
      maximumFractionDigits: effectiveDecimals,
      useGrouping: true,
    }).format(value);
  };

  // Set initial wallet mode when connected
  useEffect(() => {
    if(subaccounts.length > 0 ) {
      return;
    }
    if (connected && publicKey) {
      setWalletMode('connected');
    }
  }, [connected, publicKey]);

  const clearSearch = () => {
    setSearchInput('');
    setError('');
    setIsValidAddress(true);
    setWalletMode('connected');
    setReadonlyWalletAddress('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate Solana address
      new PublicKey(searchInput);
      setIsValidAddress(true);
      setLoading(true);
      setWalletMode('readonly');
      setReadonlyWalletAddress(searchInput);
    } catch (error) {
      setError('Invalid Solana address');
      setIsValidAddress(false);
      console.error("Search error:", error);
    }
  };

  useEffect(() => {
    if(subaccounts.length > 0 && walletMode === 'readonly') {
      return;
    }
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        const targetAddress = walletMode === 'readonly' ? readonlyWalletAddress : publicKey?.toBase58();
        if (!targetAddress) {
          setSubaccounts([]);
          return;
        }
        const accounts = await getSubaccounts(targetAddress);
        console.log("Raw Subaccounts:", accounts);
        
        const processedSubaccounts = await Promise.all(accounts.map(async (account, index) => {
          const totalSpotValue = account.spotBalances.reduce((total, spot) => total + spot.value, 0);
          const totalPerpValue = account.perpPositions.reduce((total, position) => total + position.quoteAssetAmount.toNumber() / 1e9, 0);
          const unrealizedPnl = account.unrealizedPnl.toNumber() / 1e9;

          // Convert perp positions to Position interface
          const positions = account.perpPositions
            .filter(perp => !perp.baseAssetAmount.isZero())
            .map(perp => {
              const direction = perp.baseAssetAmount.gt(new BN(0)) ? 'long' as const : 'short' as const;
              const baseSize = Math.abs(perp.baseAssetAmount.toNumber() / 1e9);
              const quoteSize = Math.abs(perp.quoteAssetAmount.toNumber() / 1e9);
              const avgEntryPrice = perp.baseAssetAmount.abs().gt(new BN(0)) 
                ? perp.quoteAssetAmount.abs().mul(new BN(1e6)).div(perp.baseAssetAmount.abs()).toNumber() / 1e6
                : 0;

              return {
                market: `PERP-${perp.marketIndex}`,
                direction,
                size: baseSize,
                leverage: quoteSize > 0 ? baseSize * avgEntryPrice / quoteSize : 0,
                entryPrice: avgEntryPrice,
                pnl: (perp.quoteAssetAmount.toNumber() / 1e9) + (perp.settledPnl.toNumber() / 1e9)
              };
            });

          return {
            index,
            totalValue: totalSpotValue + totalPerpValue + unrealizedPnl,
            spotBalances: account.spotBalances,
            positions,
            openOrders: [], // We'll need to implement this if needed
            pnl: unrealizedPnl
          };
        }));
        
        setSubaccounts(processedSubaccounts);
      } catch (error) {
        console.error("Error fetching subaccounts:", error);
        setSubaccounts([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch accounts when wallet changes or search is performed
    if (connected && publicKey && walletMode === 'connected') {
      fetchAccounts();
    } else if (walletMode === 'readonly' && readonlyWalletAddress) {
      fetchAccounts();
    }
  }, [publicKey, connected, walletMode, readonlyWalletAddress]);

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
                  className={`w-full pl-9 pr-10 py-2 bg-card/50 backdrop-blur-sm border ${
                    isValidAddress ? 'border-border/50' : 'border-red-500'
                  } rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50`}
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
              {!isValidAddress && (
                <p className="text-sm text-red-500 mt-1">Invalid wallet address</p>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !searchInput || !isValidAddress}
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
