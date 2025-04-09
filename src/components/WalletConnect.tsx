import { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

export const WalletConnect = () => {
  const [address, setAddress] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);

  const handleConnect = () => {
    // Here you would typically integrate with a wallet provider
    // For now, we'll just validate the address format
    if (address.match(/^[A-HJ-NP-Za-km-z1-9]*$/)) {
      setIsConnected(true);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAddress('');
  };

  return (
    <Card className="p-4 mb-4 bg-drift-card-dark border-drift-dark-blue">
      <div className="space-y-4">
        {!isConnected ? (
          <>
            <Input
              placeholder="Enter wallet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-drift-bg-dark text-white"
            />
            <Button
              onClick={handleConnect}
              className="btn-primary w-full"
              disabled={!address}
            >
              Connect Wallet
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-success">Connected: {address}</p>
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              className="w-full"
            >
              Disconnect
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
