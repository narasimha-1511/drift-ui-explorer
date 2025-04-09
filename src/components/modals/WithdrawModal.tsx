import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import useStore from '@/store/useStore';
import { withdrawFromSubaccount, SPOT_MARKET_INDEXES, type SpotMarketToken } from '@/services/drift';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@solana/wallet-adapter-react';

const WithdrawModal: React.FC = () => {
  const { connected } = useWallet();
  const { activeModal, setActiveModal, selectedSubaccountIndex, subaccounts } = useStore();
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<SpotMarketToken>('USDC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (activeModal === 'withdraw') {
      setAmount('');
      setError('');
    }
  }, [activeModal]);

  // Make sure we have a valid subaccount
  const selectedSubaccount = subaccounts.find(s => s.index === selectedSubaccountIndex);
  const selectedSpotBalance = selectedSubaccount?.spotBalances.find(b => b.token === token);

  // Check if we have a position
  const hasPosition = selectedSpotBalance?.hasPosition ?? false;
  const maxAmount = hasPosition ? selectedSpotBalance.balance : 0;

  const handleSetMax = () => {
    setAmount(maxAmount.toString());
  };

  const handleWithdraw = async () => {
    if (!connected) {
      setError('Please connect your wallet first');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.log('Amount validation failed:', { amount, parsedAmount });
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!token) {
      console.log('Token validation failed:', { token });
      setError('Please select a token');
      return;
    }

    if (selectedSubaccountIndex === null || selectedSubaccountIndex === undefined) {
      console.log('Subaccount validation failed:', { selectedSubaccountIndex });
      setError('Please select a subaccount first');
      return;
    }

    if (!selectedSubaccount) {
      console.log('Selected subaccount not found:', { selectedSubaccountIndex, subaccounts });
      setError('Selected subaccount not found');
      return;
    }

    if (!hasPosition) {
      setError(`No ${token} position found in this subaccount`);
      return;
    }

    if (parsedAmount > maxAmount) {
      console.log('Amount exceeds balance:', { amount: parsedAmount, maxAmount });
      setError(`Insufficient balance. Maximum available: ${maxAmount} ${token}`);
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      console.log('Starting withdraw with:', {
        subaccountIndex: selectedSubaccountIndex,
        amount: parsedAmount,
        token,
        marketIndex: SPOT_MARKET_INDEXES[token]
      });

      const marketIndex = SPOT_MARKET_INDEXES[token];
      await withdrawFromSubaccount(
        selectedSubaccountIndex,
        parsedAmount,
        marketIndex
      );
      
      setActiveModal(null);
      setAmount('');
    } catch (error: any) {
      console.error('Withdraw error:', error);
      setError(error.message || 'Failed to withdraw. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Don't render if no subaccount is selected
  if (selectedSubaccountIndex === null || selectedSubaccountIndex === undefined) {
    return null;
  }

  return (
    <Dialog open={activeModal === 'withdraw'} onOpenChange={() => setActiveModal(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw from Subaccount {selectedSubaccountIndex}</DialogTitle>
          <DialogDescription>
            Withdraw tokens from your Drift Protocol subaccount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Token</label>
            <Select value={token} onValueChange={(value) => setToken(value as SpotMarketToken)}>
              <SelectTrigger>
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(SPOT_MARKET_INDEXES).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Amount</label>
              <span className="text-sm text-muted-foreground">
                Available: {maxAmount} {token}
              </span>
            </div>
            <div className="flex space-x-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="any"
              />
              <Button variant="outline" onClick={handleSetMax}>MAX</Button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          <Button 
            className="w-full" 
            onClick={handleWithdraw} 
            disabled={loading || !connected || !hasPosition}
          >
            {loading ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawModal;
