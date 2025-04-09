import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useStore from '@/store/useStore';
import { withdrawFromSubaccount } from '@/services/drift';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SPOT_MARKET_NAMES } from '@/services/drift';

const WithdrawModal: React.FC = () => {
  const { activeModal, setActiveModal, selectedSubaccountIndex, subaccounts } = useStore();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState('USDC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedSubaccount = selectedSubaccountIndex !== null
    ? subaccounts.find(s => s.index === selectedSubaccountIndex)
    : null;

  const selectedSpotBalance = selectedSubaccount?.spotBalances.find(b => b.token === token);
  const maxAmount = selectedSpotBalance?.balance || 0;

  const handleSetMax = () => {
    setAmount(maxAmount.toString());
  };

  const handleWithdraw = async () => {
    if (!amount || !token) return;
    
    setError('');
    setLoading(true);
    
    try {
      const marketIndex = Object.entries(SPOT_MARKET_NAMES).find(
        ([_, token]) => token === token
      )?.[0];

      if (marketIndex === undefined) {
        throw new Error('Invalid token selected');
      }

      await withdrawFromSubaccount(
        selectedSubaccountIndex || 0,
        parseFloat(amount),
        parseInt(marketIndex)
      );
      setActiveModal(null);
      setAmount('');
    } catch (error) {
      console.error('Withdraw error:', error);
      setError('Failed to withdraw. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={activeModal === 'withdraw'} onOpenChange={() => activeModal === 'withdraw' && setActiveModal(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw from Subaccount #{selectedSubaccountIndex}</DialogTitle>
          <DialogDescription>
            Withdraw tokens from your Drift Protocol subaccount.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Token</label>
            <Select value={token} onValueChange={setToken}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(SPOT_MARKET_NAMES).map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Amount</label>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg pr-16"
                disabled={loading}
              />
              <Button
                onClick={handleSetMax}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
                type="button"
              >
                MAX
              </Button>
            </div>
            {selectedSpotBalance && (
              <p className="text-sm text-muted-foreground mt-1">
                Available: {selectedSpotBalance.balance.toFixed(token === 'USDC' ? 2 : 4)} {token}
              </p>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <Button
            onClick={handleWithdraw}
            disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawModal;
