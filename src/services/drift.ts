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
  8: "BNB",
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

interface SpotBalance {
  token: string;
  balance: number;
  value: number;
  collateralValue: number;
  isCollateral: boolean;
  unrealizedPnl: number;
}

interface SubaccountWithBalances {
  subAccountId: number;
  authority: PublicKey;
  spotBalances: SpotBalance[];
  perpPositions: any[];
  unrealizedPnl: BN;
}

class EmptyWallet {
  publicKey: PublicKey;

  constructor(publicKey: PublicKey) {
    this.publicKey = publicKey;
  }

  async signTransaction(tx: any) {
    return tx;
  }

  async signAllTransactions(txs: any[]) {
    return txs;
  }
}

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

// Cache for market metadata
let marketMetadataCache: Record<number, { decimals: number; mint: PublicKey; name: string }> = {};

export const getSubaccounts = async (walletAddress: string): Promise<SubaccountWithBalances[]> => {
  try {
    const pubKey = new PublicKey(walletAddress);
    const driftClient = await getDriftClient(new EmptyWallet(pubKey));

    // Get all accounts first
    const accounts = await driftClient.getUserAccountsForAuthority(pubKey);
    console.log(`Found ${accounts.length} accounts for authority:`, pubKey.toString());

    // Initialize market metadata cache
    const marketPromises = Array.from({ length: 20 }).map(async (_, i) => {
      try {
        const spotMarketAccount = await driftClient.getSpotMarketAccount(i);
        const tokenMint = spotMarketAccount.mint;
        // Get token metadata from the mint
        const mintInfo = await connection.getParsedAccountInfo(tokenMint);
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 6;
        const name = String.fromCharCode(...spotMarketAccount.name).trim();
        
        marketMetadataCache[i] = {
          decimals,
          mint: tokenMint,
          name
        };
        
        console.log(`Market ${i} metadata:`, {
          mint: tokenMint.toString(),
          decimals,
          name
        });
      } catch (error) {
        console.warn(`Failed to get metadata for market ${i}:`, error);
      }
    });

    // Wait for all market metadata to be fetched
    await Promise.all(marketPromises);

    // Get all market data first
    const marketDataEntries = await Promise.all(
      Array.from({ length: 10 }).map(async (_, i) => {
        try {
          const oracle = await driftClient.getOracleDataForSpotMarket(i);
          return { type: 'spot', marketIndex: i, oraclePrice: oracle.price };
        } catch (error) {
          console.warn(`Error fetching oracle price for market ${i}:`, error);
          return null;
        }
      })
    );

    const marketData = marketDataEntries.reduce((acc, data) => {
      if (data) {
        const key = `${data.type}-${data.marketIndex}`;
        acc[key] = data.oraclePrice;
      }
      return acc;
    }, {} as Record<string, BN>);

    // Process each account
    const processedAccounts = await Promise.all(accounts.map(async (account) => {
      try {
        const index = account.subAccountId;
        console.log(`Processing subaccount ${index}`, {
          subaccountId: account.subAccountId,
          authority: account.authority.toString()
        });

        // Get user instance for this subaccount
        const user = await driftClient.getUser(account.subAccountId, pubKey);

        // Process spot positions
        const spotBalances = await Promise.all(
          (await user.getActiveSpotPositions()).map(async (position, index) => {
            try {
              const marketIndex = position.marketIndex;
              
              // Check if position exists and has non-zero balance
              if (!position || position.scaledBalance.isZero()) {
                console.log(`Skipping market ${marketIndex} - zero balance`);
                return null;
              }

              // Get market metadata and price
              let price;
              const marketMeta = marketMetadataCache[marketIndex];
              try {
                const oracle = await driftClient.getOracleDataForSpotMarket(marketIndex);
                console.log(`Market ${marketIndex} data:`, {
                  price: oracle.price.toString(),
                  marketName: marketMeta?.name,
                  mint: marketMeta?.mint.toString(),
                  decimals: marketMeta?.decimals
                });
                price = oracle.price;
              } catch (error) {
                console.warn(`Failed to get price for market ${marketIndex}:`, error);
                price = new BN(0);
              }

              // Get token decimals from cache
              const nativeDecimals = marketMeta?.decimals || 6;
              
              // Get actual token amount and calculate balance
              const tokenAmount = await user.getTokenAmount(marketIndex);
              const balance = tokenAmount.toNumber() / Math.pow(10, nativeDecimals);
              
              // Calculate USD value
              const priceInUsd = price.toNumber() / 1e6;
              const calculatedValue = balance * priceInUsd;
              
              console.log(`Value calculation for market ${marketIndex}:`, {
                balance,
                priceInUsd,
                calculatedValue,
                nativeDecimals,
                tokenAmount: tokenAmount.toString()
              });

              // Format decimals based on value size
              const balanceDecimals = Math.abs(balance) < 0.01 ? 6 : 
                                    Math.abs(balance) < 1 ? 4 : 2;
              
              const valueDecimals = Math.abs(calculatedValue) < 0.01 ? 6 : 
                                  Math.abs(calculatedValue) < 1 ? 4 : 2;

              const formattedBalance = Number(balance.toFixed(balanceDecimals));
              const formattedValue = Number(calculatedValue.toFixed(valueDecimals));

              // All non-zero balances are collateral
              const isCollateral = marketIndex === 0 || position.scaledBalance.gt(new BN(0));
              const collateralValue = isCollateral ? formattedValue : 0;

              return {
                token: marketMeta?.name || `UNKNOWN-${marketIndex}`,
                balance: formattedBalance,
                value: formattedValue,
                collateralValue,
                isCollateral,
                unrealizedPnl: 0 // Added to match SpotBalance type
              };
            } catch (error) {
              console.error(`Error processing spot position ${index}:`, error);
              return null;
            }
          })
        );

        // Filter out null values and create subaccount object
        const filteredSpotBalances = spotBalances.filter(Boolean) as SpotBalance[];

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
                  // Entry price = quote_amount / base_amount (scaled by 1e9)
                  const entryPrice = quoteAbs.mul(new BN(1e9)).div(baseAbs);
                  const priceDiff = currentPrice.sub(entryPrice);
                  const unrealizedPnl = priceDiff.mul(position.baseAssetAmount).div(new BN(1e9));
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

        return {
          subAccountId: account.subAccountId,
          authority: account.authority,
          spotBalances: filteredSpotBalances,
          perpPositions,
          unrealizedPnl: totalUnrealizedPnl
        };
      } catch (error) {
        console.error(`Error processing account ${account.subAccountId}:`, error);
        return {
          subAccountId: account.subAccountId,
          authority: account.authority,
          spotBalances: [],
          perpPositions: [],
          unrealizedPnl: new BN(0)
        };
      }
    }));

    await driftClient.unsubscribe();
    
    return processedAccounts;
  } catch (error) {
    console.error('Error fetching subaccounts:', error);
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