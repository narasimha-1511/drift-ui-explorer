import { FC, useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { WalletName } from '@solana/wallet-adapter-base';

export const WalletButton: FC = () => {
  const { wallet, disconnect, connected, connecting, select } = useWallet();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    try {
      // If wallet is already selected but not connected, try to connect
      if (wallet && !connected) {
        await wallet.adapter.connect();
      }
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  }, [wallet, connected]);

  const handleDisconnect = useCallback(async () => {
    try {
      setIsDisconnecting(true);
      await disconnect();
      // Clear any cached wallet state
      localStorage.removeItem('walletName');
      // Force disconnect from Phantom
      if (window.solana?.isConnected) {
        await window.solana.disconnect();
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsDisconnecting(false);
    }
  }, [disconnect]);

  // Try to restore previous wallet connection on mount
  useEffect(() => {
    const savedWalletName = localStorage.getItem('walletName');
    if (savedWalletName && !connected && !connecting && !wallet) {
      const walletAdapter = window.solana;
      if (walletAdapter?.isPhantom) {
        select('Phantom' as WalletName);
      }
    }
  }, [select, connected, connecting, wallet]);

  // Save wallet name when connected
  useEffect(() => {
    if (connected && wallet) {
      localStorage.setItem('walletName', wallet.adapter.name);
    }
  }, [connected, wallet]);

  // Add debug logging
  useEffect(() => {
    console.log('Wallet state:', {
      connected,
      connecting,
      disconnecting: isDisconnecting,
      walletName: wallet?.adapter?.name,
      hasProvider: !!window.solana,
      isPhantom: window.solana?.isPhantom,
      isConnected: window.solana?.isConnected
    });
  }, [connected, connecting, isDisconnecting, wallet]);

  return (
    <WalletMultiButton 
      className={connected ? "wallet-adapter-button" : "wallet-adapter-button-trigger"}
      onClick={connected ? handleDisconnect : handleConnect}
      disabled={connecting || isDisconnecting}
    >
      {connecting ? 'Connecting...' :
       isDisconnecting ? 'Disconnecting...' :
       connected ? (wallet?.adapter.name || 'Connected') : 
       'Connect Wallet'}
    </WalletMultiButton>
  );
};
