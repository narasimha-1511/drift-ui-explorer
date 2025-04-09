import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  LedgerWalletAdapter,
  CloverWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { ConnectionConfig } from '@solana/web3.js';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
  children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
  // Use Helius RPC endpoint for better reliability
  const endpoint = 'https://rpc.helius.xyz/?api-key=1aec2a6d-3898-4857-b0e4-2d7af1d4f29e';
  const config: ConnectionConfig = {
    commitment: 'confirmed',
    wsEndpoint: 'wss://rpc.helius.xyz/?api-key=1aec2a6d-3898-4857-b0e4-2d7af1d4f29e',
    confirmTransactionInitialTimeout: 120000, // 2 minutes
  };

  // Initialize wallet adapters
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new LedgerWalletAdapter(),
      new CloverWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint} config={config}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
