import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export const WalletButton: FC = () => {
  const { wallet, connected } = useWallet();

  if (!connected) {
    return (
      <WalletMultiButton className="wallet-adapter-button-trigger" />
    );
  }

  return (
    <WalletMultiButton className="wallet-adapter-button">
      {wallet?.adapter.name}
    </WalletMultiButton>
  );
};
