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
      // Get oracle prices for all markets (spot and perp)
      const marketPromises = [
        ...Object.keys(account.spotPositions).map(async (index) => {
          const marketIndex = parseInt(index);
          if (marketIndex === 0) return null; // Skip USDC
          try {
            const oracle = await driftClient.getOracleDataForSpotMarket(marketIndex);
            return {
              type: 'spot' as const,
              marketIndex,
              oraclePrice: oracle.price
            };
          } catch (error) {
            console.warn(`Failed to get oracle price for spot market ${marketIndex}:`, error);
            return null;
          }
        }),
        ...account.perpPositions.map(async (position) => {
          if (position.baseAssetAmount.isZero()) return null;
          try {
            const oracle = await driftClient.getOracleDataForPerpMarket(position.marketIndex);
            return {
              type: 'perp' as const,
              marketIndex: position.marketIndex,
              oraclePrice: oracle.price
            };
          } catch (error) {
            console.warn(`Failed to get oracle price for perp market ${position.marketIndex}:`, error);
            return null;
          }
        })
      ];

      // Wait for all market data
      const marketData = (await Promise.all(marketPromises))
        .filter(data => data !== null)
        .reduce((acc, data) => {
          if (data) {
            const key = `${data.type}-${data.marketIndex}`;
            acc[key] = data.oraclePrice;
          }
          return acc;
        }, {} as Record<string, BN>);

      // Calculate unrealized PnL for perp positions
      let totalUnrealizedPnl = new BN(0);
      const perpPositions = account.perpPositions
        .filter(position => !position.baseAssetAmount.isZero())
        .map(position => {
          try {
            const currentPrice = marketData[`perp-${position.marketIndex}`];
            if (currentPrice && position.baseAssetAmount && position.quoteAssetAmount) {
              // Calculate entry price from base and quote amounts
              const baseAbs = position.baseAssetAmount.abs();
              const quoteAbs = position.quoteAssetAmount.abs();
              
              if (baseAbs.gt(new BN(0))) {
                // Entry price = quote_amount / base_amount (scaled by 1e6)
                const entryPrice = quoteAbs.mul(new BN(1e6)).div(baseAbs);
                const priceDiff = currentPrice.sub(entryPrice);
                const unrealizedPnl = priceDiff.mul(position.baseAssetAmount).div(new BN(1e6));
                totalUnrealizedPnl = totalUnrealizedPnl.add(unrealizedPnl);

                console.log(`PnL calculation for perp ${position.marketIndex}:`, {
                  baseAmount: baseAbs.toString(),
                  quoteAmount: quoteAbs.toString(),
                  entryPrice: entryPrice.toNumber() / 1e6,
                  currentPrice: currentPrice.toNumber() / 1e6,
                  priceDiff: priceDiff.toNumber() / 1e6,
                  unrealizedPnl: unrealizedPnl.toNumber() / 1e6
                });
              }
            }
            return position;
          } catch (error) {
            console.warn(`Error processing perp position ${position.marketIndex}:`, error);
            return position;
          }
        });

      // Process spot positions using the cached market data
      const spotBalances = account.spotPositions
        .map((position, marketIndex) => {
          try {
            if (position.scaledBalance.isZero()) return null;

            const token = SPOT_MARKET_NAMES[marketIndex as keyof typeof SPOT_MARKET_NAMES];
            const nativeDecimals = TOKEN_DECIMALS[token as keyof typeof TOKEN_DECIMALS];
            const driftDecimals = marketIndex === 0 ? 6 : 9;
            
            // Use BN for calculations
            const scaledBalance = position.scaledBalance;
            const balanceScaleBN = new BN(10).pow(new BN(driftDecimals));
            const balance = Number(scaledBalance.toString()) / Math.pow(10, driftDecimals);
            
            // For USDC, value is same as balance
            let valueBN = marketIndex === 0 ? scaledBalance : new BN(0);
            
            // For other tokens, calculate value based on oracle price
            if (marketIndex > 0) {
              const oraclePrice = marketData[`spot-${marketIndex}`];
              if (oraclePrice) {
                try {
                  valueBN = scaledBalance.mul(oraclePrice).div(balanceScaleBN);
                } catch (error) {
                  console.warn(`Error calculating value for ${token}:`, error);
                  valueBN = new BN(0);
                }
              }
            }
            
            // Convert to display values with proper precision
            const preciseBalance = Number(balance.toFixed(8));
            const preciseValue = Number(valueBN.toString()) / 1e6;

            const balanceDecimals = marketIndex === 0 ? 2 : 
                                 Math.abs(preciseBalance) < 0.01 ? 6 : 4;
            const valueDecimals = Math.abs(preciseValue) < 0.01 ? 6 : 
                               Math.abs(preciseValue) < 1 ? 4 : 2;

            return {
              token,
              balance: Number(preciseBalance.toFixed(balanceDecimals)),
              value: Number(preciseValue.toFixed(valueDecimals)),
              unrealizedPnl: 0 // Spot positions don't have unrealized PnL
            };
          } catch (error) {
            console.warn(`Error processing spot position ${marketIndex}:`, error);
            return null;
          }
        })
        .filter(Boolean);

      return {
        ...account,
        spotBalances,
        perpPositions,
        unrealizedPnl: totalUnrealizedPnl
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