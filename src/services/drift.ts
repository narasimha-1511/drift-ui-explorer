import { DriftClient, PublicKey, type DriftEnv, BulkAccountLoader, BN, IWallet } from "@drift-labs/sdk";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

// Spot market names mapping
export const SPOT_MARKET_NAMES = {
  0: "USDC",
  1: "SOL",
  2: "ETH",
  3: "BTC",
  4: "BONK",
  5: "JTO",
  6: "JUP",
  7: "MATIC",
} as const;

// Token decimal places in their native form
const TOKEN_DECIMALS = {
  USDC: 6,
  SOL: 9,
  ETH: 18,
  BTC: 8,
  BONK: 5,
  JTO: 6,
  JUP: 6,
  MATIC: 18,
} as const;

// Use Helius RPC endpoint for better reliability
const connection = new Connection("https://rpc.helius.xyz/?api-key=ff719d01-57ce-43b7-bffb-4f0296c11366", {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 60000, // 60 seconds
  wsEndpoint: undefined,
});

export const getDriftClient = async (wallet: IWallet) => {
  const driftClient = new DriftClient({
    connection: connection,
    wallet: wallet,
    env: "mainnet-beta" as const,
    programID: new PublicKey("dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"),
    opts: {
      skipPreflight: false,
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    }
  });

  // Only subscribe if we need real-time updates
  if (wallet.publicKey) {
    try {
      await driftClient.subscribe();
    } catch (error) {
      console.warn("WebSocket subscription failed, falling back to polling:", error);
      // Continue without WebSocket subscription
    }
  }
  
  return driftClient;
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
      const spotMarketPromises = Object.keys(account.spotPositions).map(async (index) => {
        const marketIndex = parseInt(index);
        if (marketIndex === 0) return null; // Skip USDC as it doesn't need oracle price
        try {
          const oracle = await driftClient.getOracleDataForSpotMarket(marketIndex);
          console.log(`Oracle price for market ${marketIndex} (${SPOT_MARKET_NAMES[marketIndex]}):`, {
            raw: oracle.price.toString(),
            scaled: oracle.price.toNumber() / 1e6
          });
          return {
            marketIndex,
            oraclePrice: oracle.price.toNumber()
          };
        } catch (error) {
          console.warn(`Failed to get oracle price for market ${marketIndex}:`, error);
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
      const spotBalances = account.spotPositions
        .map((position, marketIndex) => {
          if (position.scaledBalance.isZero()) return null;

          const token = SPOT_MARKET_NAMES[marketIndex as keyof typeof SPOT_MARKET_NAMES];
          // Get the token's native decimals
          const nativeDecimals = TOKEN_DECIMALS[token as keyof typeof TOKEN_DECIMALS];
          
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
            token,
            balance: Number(balance.toFixed(marketIndex === 0 ? 2 : 4)), // 2 decimals for USDC, 4 for others
            value: Number(value.toFixed(2))
          };
        })
        .filter(Boolean);

      return {
        ...account,
        spotBalances
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
  wallet: { 
    publicKey: PublicKey; 
    sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>;
  },
  subaccountIndex: number,
  amount: number,
  marketIndex: number = 0 // Default to USDC (market index 0)
) => {
  try {
    const driftClient = await getDriftClient({
      publicKey: wallet.publicKey,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    });

    // Convert amount to proper units based on token decimals
    const token = SPOT_MARKET_NAMES[marketIndex as keyof typeof SPOT_MARKET_NAMES];
    const nativeDecimals = TOKEN_DECIMALS[token as keyof typeof TOKEN_DECIMALS];
    const withdrawAmount = new BN(Math.floor(amount * Math.pow(10, nativeDecimals)));
    
    // Get the user's token account
    const tokenMints = {
      0: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      1: "So11111111111111111111111111111111111111112",   // SOL
      2: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // ETH
      3: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E", // BTC
      4: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
      5: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",  // JTO
      6: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",  // JUP
      7: "Gz7VkD4MacbEB6yC5XD3HcumEiYx2EtDYYrfikGsvopG", // MATIC
    } as const;

    const tokenMint = new PublicKey(tokenMints[marketIndex as keyof typeof tokenMints]);
    const userTokenATA = await getAssociatedTokenAddress(
      tokenMint,
      wallet.publicKey
    );

    // Get withdraw instructions
    const withdrawIxs = await driftClient.getWithdrawalIxs(
      withdrawAmount,
      marketIndex,
      userTokenATA,
      true, // reduce only
      new BN(subaccountIndex)
    );

    // Create and send transaction
    const tx = new Transaction();
    withdrawIxs.forEach(ix => tx.add(ix));
    
    const signature = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, "confirmed");
    
    return signature;
  } catch (error) {
    console.error("Error in withdrawFromSubaccount:", error);
    throw error;
  }
};