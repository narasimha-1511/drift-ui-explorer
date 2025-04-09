import { create } from 'zustand';
import { type SpotMarketToken } from '@/services/drift';

// Type definitions
export type ModalType = 'deposit' | 'withdraw' | null;

export interface SpotBalance {
  token: SpotMarketToken;
  balance: number;
  value: number;
  hasPosition: boolean;
}

export type Position = {
  market: string;
  direction: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  pnl: number;
};

export type Order = {
  id: string;
  market: string;
  type: 'limit' | 'market';
  direction: 'long' | 'short';
  price: number;
  size: number;
  status: 'open' | 'filled' | 'cancelled';
};

export interface Subaccount {
  index: number;
  spotBalances: SpotBalance[];
  positions: Position[];
  openOrders: Order[];
  totalValue: number;
  pnl: number;
}

export type WalletMode = 'connected' | 'readonly' | 'disconnected';

// State interface
interface StoreState {
  // Wallet state
  walletMode: WalletMode;
  walletConnected: boolean;
  walletAddress: string | null;
  readonlyWalletAddress: string;
  setWalletMode: (mode: WalletMode) => void;
  setWalletConnected: (connected: boolean) => void;
  setWalletAddress: (address: string | null) => void;
  setReadonlyWalletAddress: (address: string) => void;
  
  // UI state
  loading: boolean;
  setLoading: (loading: boolean) => void;
  activeModal: ModalType;
  setActiveModal: (modal: ModalType) => void;
  
  // Subaccount state
  selectedSubaccountIndex: number | null;
  setSelectedSubaccountIndex: (index: number | null) => void;
  subaccounts: Subaccount[];
  setSubaccounts: (subaccounts: Subaccount[]) => void;
}

// Create store
const useStore = create<StoreState>((set) => ({
  // Wallet state
  walletMode: 'disconnected',
  walletConnected: false,
  walletAddress: null,
  readonlyWalletAddress: '',
  setWalletMode: (mode) => set({ walletMode: mode }),
  setWalletConnected: (connected) => set({ walletConnected: connected }),
  setWalletAddress: (address) => set({ walletAddress: address }),
  setReadonlyWalletAddress: (address) => set({ readonlyWalletAddress: address }),
  
  // UI state
  loading: false,
  setLoading: (loading) => set({ loading }),
  activeModal: null,
  setActiveModal: (modal) => set({ activeModal: modal }),
  
  // Subaccount state
  selectedSubaccountIndex: null,
  setSelectedSubaccountIndex: (index) => set({ selectedSubaccountIndex: index }),
  subaccounts: [],
  setSubaccounts: (subaccounts) => set({ subaccounts }),
}));

export default useStore;
