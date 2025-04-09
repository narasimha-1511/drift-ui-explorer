
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, ArrowRight } from 'lucide-react';
import useStore from '@/store/useStore';

const DepositModal: React.FC = () => {
  const { activeModal, setActiveModal, selectedSubaccountIndex, subaccounts } = useStore();
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const isOpen = activeModal === 'deposit';
  const selectedSubaccount = selectedSubaccountIndex !== null ? 
    subaccounts.find(s => s.index === selectedSubaccountIndex) : null;
  
  const handleClose = () => {
    setActiveModal(null);
    setAmount('');
  };
  
  const handleSubmit = () => {
    setSubmitting(true);
    // Here we would interact with Drift SDK
    setTimeout(() => {
      setSubmitting(false);
      handleClose();
      // Show success toast (to be implemented)
    }, 1500);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-card border-border/30 sm:max-w-[425px]">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-lg pointer-events-none"></div>
        <DialogHeader className="relative">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-primary" />
            <DialogTitle className="text-xl">Deposit Funds</DialogTitle>
          </div>
          <DialogDescription>
            {selectedSubaccount !== null
              ? `Add funds to Subaccount #${selectedSubaccountIndex}`
              : 'Select a subaccount first'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 relative">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-secondary/20 border-border/30 pr-12"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                USDC
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">
                Available in wallet: 100.00 USDC
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto py-0 px-1 text-primary hover:text-primary/80 hover:bg-transparent"
                onClick={() => setAmount('100')}
              >
                MAX
              </Button>
            </div>
          </div>
        </div>
        
        <DialogFooter className="relative">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="border-border/30 bg-secondary/20 text-white hover:bg-secondary/40"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={submitting || !amount || parseFloat(amount) <= 0}
            className="bg-primary hover:bg-primary/90 gap-1"
          >
            {submitting ? 'Processing...' : (
              <>
                Deposit <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;
