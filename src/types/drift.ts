import { BN } from "@drift-labs/sdk";

export interface SpotBalance {
  token: string;
  balance: number;
  value: number;
  unrealizedPnl: number;
}

export interface Position {
  market: string;
  direction: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  pnl: number;
}

export interface PerpPosition {
  marketIndex: number;
  baseAssetAmount: BN;
  quoteAssetAmount: BN;
  lastCumulativeFundingRate: BN;
  lastFundingRate: BN;
  openOrders: number;
  settledPnl: BN;
  lpShares: BN;
  entryPrice: BN;
  breakEvenPrice: BN;
}

export interface ProcessedAccount {
  spotBalances: SpotBalance[];
  perpPositions: PerpPosition[];
  unrealizedPnl: BN;
}

export interface Subaccount {
  index: number;
  totalValue: number;
  spotBalances: SpotBalance[];
  positions: Position[];
  openOrders: any[];
  pnl: number;
}

// SDK Types
export interface SpotMarket {
  historical: {
    lastOraclePriceTwap: BN;
  };
}

export interface SpotPosition {
  scaledBalance: BN;
  market: SpotMarket;
}
