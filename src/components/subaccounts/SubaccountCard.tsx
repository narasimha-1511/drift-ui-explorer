import React from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import useStore from '@/store/useStore';
import { Subaccount } from '@/types/drift';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface SubaccountCardProps {
  subaccount: Subaccount;
  onDeposit: () => void;
  onWithdraw: () => void;
}

const SubaccountCard: React.FC<SubaccountCardProps> = ({ subaccount, onDeposit, onWithdraw }) => {
  const navigate = useNavigate();
  const { setSelectedSubaccountIndex, setActiveModal, walletMode } = useStore();
  
  const handleViewDetails = () => {
    setSelectedSubaccountIndex(subaccount.index);
    navigate(`/subaccount/${subaccount.index}`);
  };
  
  const handleDeposit = () => {
    setSelectedSubaccountIndex(subaccount.index);
    setActiveModal('deposit');
    onDeposit();
  };
  
  const handleWithdraw = () => {
    setSelectedSubaccountIndex(subaccount.index);
    setActiveModal('withdraw');
    onWithdraw();
  };

  // Format number with commas and proper decimal places
  const formatNumber = (value: number, decimals: number = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Display positions summary (only first position or count)
  const positions = subaccount.positions || [];
  const positionsSummary = positions.length > 0 
    ? `${positions[0].market} | ${positions[0].direction} | ${positions[0].leverage}x${positions.length > 1 ? ` +${positions.length - 1} more` : ''}`
    : 'No active positions';

  return (
    <Card className="card-hover bg-drift-card-dark border-border/50 overflow-hidden w-full flex flex-col">
      <CardFooter className="bg-drift-dark-blue/50 py-2">
        <div className="text-lg flex w-full justify-between items-center">
          <span>Subaccount #{subaccount.index}</span>
          <span className={positions.length > 0 ? 'status-success' : 'status-inactive'}>●</span>
        </div>
      </CardFooter>
      <CardContent>
        <div className="flex flex-col gap-4 pt-4">
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="text-xl font-semibold">
              ${formatNumber(
                (subaccount.spotBalances || []).reduce((total, spot) => total + spot.value, 0)
              )}
            </p>
          </div>

          {/* Spot Positions */}
          {subaccount.spotBalances && subaccount.spotBalances.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Spot Positions</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {subaccount.spotBalances.map((spot) => (
                  <div 
                    key={spot.token}
                    className="flex justify-between items-center p-2 rounded-lg bg-background/50 border border-border/50"
                  >
                    <div>
                      <span className="text-[8px]font-medium">{spot.token}</span>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(spot.balance, spot.token === 'USDC' ? 2 : 4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${formatNumber(spot.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Positions</p>
              <p className="text-sm font-medium">{positionsSummary}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open Orders</p>
              <p className="text-sm font-medium">{(subaccount.openOrders || []).length} active orders</p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex w-full gap-2 pt-2 px-4 pb-4 mt-auto">
        <div className="flex flex-1 gap-2">
          {walletMode === 'connected' && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 min-w-[80px]"
                onClick={handleDeposit}
              >
                Deposit
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1 min-w-[80px]"
                onClick={handleWithdraw}
              >
                Withdraw
              </Button>
            </>
          )}
        </div>
        <Button 
          variant="default" 
          size="sm"
          className="min-w-[100px] shrink-0"
          onClick={handleViewDetails}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SubaccountCard;
