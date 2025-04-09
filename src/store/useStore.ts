import { create } from 'zustand';
import { Subaccount } from '@/types/drift';

// Type definitions
export type WalletMode = 'connected' | 'readonly' | 'disconnected';
export type ModalType = 'deposit' | 'withdraw' | 'placeOrder' | null;
export type Position = {
  market: number;
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

// State interface
interface StoreState {
  // Wallet state
  walletMode: WalletMode;
  walletConnected: boolean;
  walletAddress: string | null;
  readonlyWalletAddress: string;
  
  // Subaccount state
  subaccounts: Subaccount[];
  selectedSubaccountIndex: number | null;
  
  // UI state
  loading: boolean;
  activeModal: ModalType;
  
  // Actions
  setWalletMode: (mode: WalletMode) => void;
  setWalletConnected: (connected: boolean) => void;
  setWalletAddress: (address: string | null) => void;
  setReadonlyWalletAddress: (address: string) => void;
  setSubaccounts: (subaccounts: Subaccount[]) => void;
  setSelectedSubaccountIndex: (index: number | null) => void;
  setLoading: (loading: boolean) => void;
  setActiveModal: (modal: ModalType) => void;
}

// Create store
const useStore = create<StoreState>((set) => ({
  // Default state
  walletMode: 'disconnected',
  walletConnected: false,
  walletAddress: null,
  readonlyWalletAddress: '',
  subaccounts: [],
  selectedSubaccountIndex: null,
  loading: false,
  activeModal: null,
  
  // Actions
  setWalletMode: (mode) => set({ walletMode: mode }),
  setWalletConnected: (connected) => set({ walletConnected: connected }),
  setWalletAddress: (address) => set({ walletAddress: address }),
  setReadonlyWalletAddress: (address) => set({ readonlyWalletAddress: address }),
  setSubaccounts: (subaccounts) => set({ subaccounts }),
  setSelectedSubaccountIndex: (index) => set({ selectedSubaccountIndex: index }),
  setLoading: (loading) => set({ loading }),
  setActiveModal: (modal) => set({ activeModal: modal }),
}));

export default useStore;
