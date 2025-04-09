import React from 'react';
import useStore from '@/store/useStore';
import SubaccountCard from './SubaccountCard';
import { Subaccount } from '@/types/drift';
import { Loader2 } from 'lucide-react';

interface SubaccountGridProps {
  loading: boolean;
}

const SubaccountGrid: React.FC<SubaccountGridProps> = ({ loading }) => {
  const { subaccounts } = useStore();
  const { setSelectedSubaccountIndex, setActiveModal } = useStore();

  const handleDeposit = (index: number) => {
    setSelectedSubaccountIndex(index);
    setActiveModal('deposit');
  };

  const handleWithdraw = (index: number) => {
    setSelectedSubaccountIndex(index);
    setActiveModal('withdraw');
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-5 animate-pulse">
            <div className="h-6 w-32 bg-muted/20 rounded mb-2"></div>
            <div className="h-8 w-24 bg-muted/20 rounded mb-4"></div>
            <div className="space-y-2">
              <div className="h-12 bg-muted/20 rounded"></div>
              <div className="h-12 bg-muted/20 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!subaccounts?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No subaccounts found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {subaccounts.map((subaccount: Subaccount) => (
        <SubaccountCard 
          key={subaccount.index} 
          subaccount={subaccount}
          onDeposit={() => handleDeposit(subaccount.index)}
          onWithdraw={() => handleWithdraw(subaccount.index)}
        />
      ))}
    </div>
  );
};

export default SubaccountGrid;
