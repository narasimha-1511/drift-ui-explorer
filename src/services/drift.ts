import { DriftClient, PublicKey, type DriftEnv, BulkAccountLoader, BN, IWallet } from "@drift-labs/sdk";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

// Spot market names mapping
export const SPOT_MARKET_INDEXES = {
  USDC: 0,
  SOL: 1,
  ETH: 2,
  BTC: 3,
  BONK: 4,
  JTO: 5,
  JUP: 6,
  MATIC: 7,
} as const;

export type SpotMarketToken = keyof typeof SPOT_MARKET_INDEXES;

// Token decimals
export const TOKEN_DECIMALS: Record<SpotMarketToken, number> = {
  USDC: 6,
  SOL: 9,
  ETH: 8,
  BTC: 8,
  BONK: 5,
  JTO: 8,
  JUP: 6,
  MATIC: 8,
};

// Drift program error codes
const DRIFT_ERROR_CODES: Record<number, string> = {
  3012: "User has no position in market",
  3013: "Invalid margin ratio",
  3014: "Insufficient deposits",
  3015: "Invalid token amount",
  3016: "Invalid market index",
  // Add more error codes as needed
};

// Use Helius RPC endpoint for better reliability
const connection = new Connection("https://rpc.helius.xyz/?api-key=ff719d01-57ce-43b7-bffb-4f0296c11366", {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000, // 60 seconds
  wsEndpoint: undefined,
});

export const getDriftClient = async (wallet: IWallet) => {
  try {
    // Create a wallet adapter that matches Drift's expected interface
    const driftWallet = {
      publicKey: wallet.publicKey,
      signTransaction: async (tx: Transaction) => {
        return await wallet.signTransaction(tx);
      },
      signAllTransactions: async (txs: Transaction[]) => {
        return await wallet.signAllTransactions(txs);
      }
    };

    const driftClient = new DriftClient({
      connection: connection,
      wallet: driftWallet,
      env: "mainnet-beta" as const,
      programID: new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"),
      opts: {
        skipPreflight: false,
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      }
    });

    // Initialize the client
    await driftClient.subscribe();

    // Load user account if it exists
    try {
      const userAccountPublicKey = await driftClient.getUserAccountPublicKey();
      const userAccount = await driftClient.getUserAccount();
      
      if (!userAccount) {
        console.log('No user account found, will be created on first transaction');
      } else {
        console.log('Found user account:', userAccountPublicKey.toString());
        
        // Log all spot positions for debugging
        console.log('Spot positions:', userAccount.spotPositions.map(p => ({
          marketIndex: p.marketIndex,
          balance: p.scaledBalance.toString(),
          token: Object.keys(SPOT_MARKET_INDEXES).find(k => 
            SPOT_MARKET_INDEXES[k as SpotMarketToken] === p.marketIndex
          )
        })));
      }
    } catch (err) {
      console.log('No user account found, will be created on first transaction');
    }

    return driftClient;
  } catch (error) {
    console.error('Error initializing Drift client:', error);
    throw error;
  }
};

export const getSubaccounts = async (walletAddress: string) => {
  try {
    // Validate public key format first
    if (!PublicKey.isOnCurve(walletAddress)) {
      throw new Error("Invalid wallet address format");
    }

    const pubKey = new PublicKey(walletAddress);
    
    const driftClient = await getDriftClient({
      publicKey: pubKey,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    });

    const accounts = await driftClient.getUserAccountsForAuthority(pubKey);
    
    // Process each account to include spot balances
    const processedAccounts = await Promise.all(accounts.map(async (account) => {
      // Get oracle prices for all spot markets except USDC
      const spotMarketPromises = Object.keys(SPOT_MARKET_INDEXES).map(async (token) => {
        const marketIndex = SPOT_MARKET_INDEXES[token as SpotMarketToken];
        if (marketIndex === 0) return null; // Skip USDC as it doesn't need oracle price
        try {
          const oracle = await driftClient.getOracleDataForSpotMarket(marketIndex);
          console.log(`Oracle price for market ${marketIndex} (${token}):`, {
            raw: oracle.price.toString(),
            scaled: oracle.price.toNumber() / 1e6
          });
          return {
            marketIndex,
            oraclePrice: oracle.price.toNumber()
          };
        } catch (error) {
          console.warn(`Failed to get oracle price for market ${token}:`, error);
          return null;
        }
      });

      // Wait for all spot market data
      const spotMarketData = (await Promise.all(spotMarketPromises))
        .filter(data => data !== null)
        .reduce((acc, data) => {
          if (data) acc[data.marketIndex] = data.oraclePrice;
          return acc;
        }, {} as Record<number, number>);

      // Process spot positions using the cached market data
      const spotBalances = Object.entries(SPOT_MARKET_INDEXES).map(([token, marketIndex]) => {
        const position = account.spotPositions[marketIndex];
        if (!position || position.scaledBalance.isZero()) {
          // Return a zero balance for the token
          return {
            token: token as SpotMarketToken,
            balance: 0,
            value: 0,
            hasPosition: false
          };
        }

        // Get the token's native decimals
        const nativeDecimals = TOKEN_DECIMALS[token as SpotMarketToken];
        
        // Convert BN to string first to preserve precision
        const scaledBalance = position.scaledBalance.toString();
        // Handle negative balances by getting absolute value
        const absBalance = scaledBalance.startsWith('-') ? scaledBalance.slice(1) : scaledBalance;
        // First convert from Drift's 9 decimals (or 6 for USDC) to native token decimals
        const driftDecimals = marketIndex === 0 ? 6 : 9;
        const balance = parseFloat(absBalance) / Math.pow(10, driftDecimals);
        
        // For USDC, value is same as balance
        let value = marketIndex === 0 ? balance : 0;
        
        // For other tokens, calculate value based on oracle price
        if (marketIndex > 0 && spotMarketData[marketIndex]) {
          // Oracle price comes in with 6 decimals
          const oraclePrice = spotMarketData[marketIndex] / 1e6;
          value = balance * oraclePrice;
          console.log(`Value calculation for ${token}:`, {
            rawBalance: absBalance,
            driftDecimals,
            nativeDecimals,
            balance,
            oraclePrice,
            value
          });
        }

        return {
          token: token as SpotMarketToken,
          balance: Number(balance.toFixed(marketIndex === 0 ? 2 : 4)), // 2 decimals for USDC, 4 for others
          value: Number(value.toFixed(2)),
          hasPosition: true
        };
      });

      // Calculate total value
      const totalValue = spotBalances.reduce((sum, balance) => sum + balance.value, 0);

      // Get perpetual positions
      const positions = account.perpPositions
        .filter(pos => !pos.baseAssetAmount.isZero())
        .map(pos => {
          const market = driftClient.getPerpMarketAccount(pos.marketIndex);
          const quoteEntryAmount = pos.quoteEntryAmount.toNumber() / 1e6;
          const baseAssetAmount = pos.baseAssetAmount.toNumber() / 1e9;
          const entryPrice = Math.abs(quoteEntryAmount / baseAssetAmount);
          
          // Calculate unrealized PnL
          const oraclePrice = market.amm.oracle.price.toNumber() / 1e6;
          const pnl = baseAssetAmount * (oraclePrice - entryPrice);
          
          // Calculate leverage
          const collateral = account.spotPositions[0]?.scaledBalance.toNumber() / 1e6 || 0;
          const notionalSize = Math.abs(baseAssetAmount * oraclePrice);
          const leverage = collateral > 0 ? notionalSize / collateral : 0;

          return {
            market: market.name,
            direction: pos.baseAssetAmount.gt(new BN(0)) ? 'long' : 'short',
            size: Math.abs(baseAssetAmount),
            leverage,
            entryPrice,
            pnl
          };
        });

      // Get open orders
      const openOrders = account.orders
        .filter(order => order.status === 'open')
        .map(order => {
          const market = order.marketType === 'perp' 
            ? driftClient.getPerpMarketAccount(order.marketIndex).name
            : Object.keys(SPOT_MARKET_INDEXES).find(
                key => SPOT_MARKET_INDEXES[key as SpotMarketToken] === order.marketIndex
              ) || 'unknown';
          
          return {
            id: order.orderId.toString(),
            market,
            type: order.orderType === 'limit' ? 'limit' : 'market',
            direction: order.direction === 'long' ? 'long' : 'short',
            price: order.price.toNumber() / 1e6,
            size: order.baseAssetAmount.toNumber() / 1e9,
            status: 'open'
          };
        });

      // Calculate total PnL
      const pnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);

      return {
        ...account,
        spotBalances,
        positions,
        openOrders,
        totalValue,
        pnl
      };
    }));

    await driftClient.unsubscribe();
    
    return processedAccounts;
  } catch (error) {
    console.error("Error fetching subaccounts:", error);
    throw error;
  }
};

export const withdrawFromSubaccount = async (
  subaccountIndex: number,
  amount: number,
  marketIndex: number = SPOT_MARKET_INDEXES.USDC // Default to USDC
) => {
  let tokenName: SpotMarketToken | undefined;
  
  try {
    console.log('Starting withdrawFromSubaccount:', { subaccountIndex, amount, marketIndex });
    
    const wallet = window.solana;
    if (!wallet?.isConnected || !wallet.publicKey) {
      throw new Error('Please connect your wallet first');
    }

    // Ensure wallet is ready
    try {
      await wallet.connect();
      console.log('Wallet connected:', wallet.publicKey.toString());
      console.log('Wallet adapter:', wallet.adapter?.name);
    } catch (err) {
      console.error('Wallet connect error:', err);
      throw new Error('Failed to connect wallet. Please try again.');
    }

    const driftClient = await getDriftClient(wallet);
    if (!driftClient) {
      throw new Error('Failed to initialize Drift client');
    }
    console.log('Drift client initialized');

    // Initialize the client and load user account
    try {
      await driftClient.subscribe();
      
      // Get user account
      const userAccount = await driftClient.getUserAccount();
      if (!userAccount) {
        throw new Error('No user account found. Please deposit funds first.');
      }
      
      console.log('User account loaded');
      
      // Get spot position
      const spotPosition = userAccount.spotPositions.find(p => p.marketIndex === marketIndex);
      console.log('Spot position:', {
        marketIndex,
        balance: spotPosition?.scaledBalance.toString(),
        exists: !!spotPosition
      });
      
      // Convert amount to native token units
      tokenName = Object.keys(SPOT_MARKET_INDEXES).find(
        key => SPOT_MARKET_INDEXES[key as SpotMarketToken] === marketIndex
      ) as SpotMarketToken | undefined;

      if (!tokenName) {
        throw new Error('Invalid market index');
      }

      const decimals = TOKEN_DECIMALS[tokenName];
      const withdrawAmount = new BN(Math.floor(amount * Math.pow(10, decimals)));
      console.log('Withdraw amount:', { tokenName, decimals, withdrawAmount: withdrawAmount.toString() });

      // Check if user has enough balance
      if (!spotPosition || spotPosition.scaledBalance.lt(withdrawAmount)) {
        throw new Error(`Insufficient ${tokenName} balance in subaccount ${subaccountIndex}`);
      }

      // Create and send withdraw transaction
      const withdrawIx = await driftClient.getWithdrawIx(
        withdrawAmount,
        marketIndex,
        new BN(subaccountIndex)
      );

      // Create transaction
      const tx = new Transaction().add(withdrawIx);
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;

      // Simulate transaction first
      console.log('Simulating transaction...');
      const simResult = await connection.simulateTransaction(tx);
      console.log('Simulation result:', simResult);

      if (simResult.value.err) {
        throw new Error(`Transaction simulation failed: ${simResult.value.err}`);
      }

      // Send transaction
      console.log('Sending transaction...');
      const signature = await driftClient.sendTransaction(tx);
      console.log('Transaction sent:', signature.toString());

      // Wait for confirmation
      await driftClient.connection.confirmTransaction(signature.toString(), 'confirmed');
      console.log('Transaction confirmed');

      return signature;
    } catch (err: any) {
      console.error('Withdrawal error:', err);
      
      // Handle program errors
      if (err.code === 3012) {
        throw new Error(`No ${tokenName} position found in this subaccount`);
      } else if (err.code === 3013) {
        throw new Error('Invalid margin ratio');
      } else if (err.code === 3014) {
        throw new Error('Insufficient deposits');
      } else if (err.code === 3015) {
        throw new Error('Invalid token amount');
      } else {
        throw err;
      }
    } finally {
      await driftClient.unsubscribe();
    }
  } catch (error: any) {
    console.error('Withdrawal failed:', error);
    throw error;
  }
};