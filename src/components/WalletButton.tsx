import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet, Copy, LogOut, Loader2 } from 'lucide-react';
import useStore from '@/store/useStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const WalletButton = () => {
  const { 
    publicKey, 
    disconnect,
    connecting,
    connected,
  } = useWallet();
  const { setVisible } = useWalletModal();
  const { setWalletMode } = useStore();

  const handleConnect = () => {
    setVisible(true);
  };

  const handleDisconnect = async () => {
    await disconnect();
    setWalletMode('disconnected');
  };

  const handleCopyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString());
    }
  };

  const walletAddress = publicKey?.toString();
  const shortAddress = walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}` : '';

  if (!connected) {
    return (
      <Button 
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2"
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        <span>
          {connecting ? 'Connecting...' : 'Connect Wallet'}
        </span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          <span>{shortAddress}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem 
          onClick={handleCopyAddress}
          className="flex items-center cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors"
        >
          <Copy className="h-4 w-4 mr-2" />
          <span className="flex-1">Copy Address</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setVisible(true)}
          className="flex items-center cursor-pointer hover:bg-primary/10 focus:bg-primary/10 transition-colors"
        >
          <Wallet className="h-4 w-4 mr-2" />
          <span className="flex-1">Change Wallet</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleDisconnect}
          className="flex items-center cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span className="flex-1">Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletButton;
