import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Wallet, BarChart3, FileText } from 'lucide-react';
import useStore from '@/store/useStore';
import DepositModal from '@/components/modals/DepositModal';
import WithdrawModal from '@/components/modals/WithdrawModal';

const SubaccountDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { 
    subaccounts, 
    setSelectedSubaccountIndex, 
    setActiveModal,
    walletMode
  } = useStore();
  
  const subaccountIndex = parseInt(id || '0');
  const subaccount = subaccounts.find(s => s.index === subaccountIndex);
  
  // Set the selected subaccount when the component mounts
  useEffect(() => {
    setSelectedSubaccountIndex(subaccountIndex);
    return () => setSelectedSubaccountIndex(null);
  }, [subaccountIndex, setSelectedSubaccountIndex]);
  
  // Redirect to dashboard if subaccount not found
  useEffect(() => {
    if (subaccounts.length > 0 && !subaccount) {
      navigate('/');
    }
  }, [subaccount, subaccounts, navigate]);
  
  const handleDeposit = () => setActiveModal('deposit');
  const handleWithdraw = () => setActiveModal('withdraw');
  const handleBack = () => navigate('/');
  
  if (!subaccount) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading subaccount details...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container-padding mx-auto py-8 max-w-screen-2xl">
        <div className="mb-6 flex items-center">
          <Button variant="ghost" size="icon" className="mr-2" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold">Subaccount #{subaccountIndex}</h2>
            <p className="text-muted-foreground">Manage your positions, orders, and balances</p>
          </div>
        </div>
        
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <Card className="bg-card/80 backdrop-blur-sm border-border/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 pointer-events-none"></div>
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Total Value</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-3xl font-bold">
                ${(
                  (subaccount.spotBalances || []).reduce((total, spot) => total + spot.value, 0)
                ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              {walletMode === 'connected' && (
                <div className="flex gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-drift-green/30 text-drift-green hover:bg-drift-green/10 hover:border-drift-green/50"
                    onClick={handleDeposit}
                  >
                    Deposit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-drift-red/30 text-drift-red hover:bg-drift-red/10 hover:border-drift-red/50"
                    onClick={handleWithdraw}
                  >
                    Withdraw
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-card/80 backdrop-blur-sm border-border/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-50 pointer-events-none"></div>
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-lg">Positions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-3xl font-bold">{subaccount.positions.length}</p>
              <p className="text-muted-foreground mt-1">Active positions</p>
              
              {subaccount.positions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  {subaccount.positions.map((pos, idx) => (
                    <div key={idx} className="text-sm flex justify-between items-center mb-1">
                      <span className="flex items-center gap-1">
                        <span className={pos.direction === 'long' ? 'text-drift-green' : 'text-drift-red'}>
                          {pos.direction === 'long' ? '↗' : '↘'}
                        </span>
                        {pos.market}
                      </span>
                      <span className={pos.pnl >= 0 ? 'text-drift-green' : 'text-drift-red'}>
                        ${pos.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="bg-card/80 backdrop-blur-sm border-border/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-50 pointer-events-none"></div>
            <CardHeader className="pb-2 relative">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-400" />
                <CardTitle className="text-lg">Open Orders</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="relative">
              <p className="text-3xl font-bold">{subaccount.openOrders.length}</p>
              <p className="text-muted-foreground mt-1">Active orders</p>
              
              {subaccount.openOrders.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  {subaccount.openOrders.map((order) => (
                    <div key={order.id} className="text-sm flex justify-between items-center mb-1">
                      <span>{order.market} ({order.type})</span>
                      <span>${order.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Detail Tabs */}
        <Tabs defaultValue="spot" className="w-full">
          <TabsList className="bg-secondary/30 backdrop-blur-sm border border-border/20 w-full justify-start mb-6">
            <TabsTrigger value="spot" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Spot Positions</TabsTrigger>
            <TabsTrigger value="perp" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Perpetual Positions</TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Open Orders</TabsTrigger>
            {walletMode === 'connected' && <TabsTrigger value="placed" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Placed Orders</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="spot" className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(subaccount.spotBalances || []).map((spot) => (
                <Card key={spot.token} className="bg-card/80 backdrop-blur-sm border-border/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{spot.token}</span>
                      <span className="text-sm text-muted-foreground">
                        ${spot.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold">
                      {spot.balance.toLocaleString('en-US', { minimumFractionDigits: spot.token === 'USDC' ? 2 : 4, maximumFractionDigits: spot.token === 'USDC' ? 2 : 4 })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="perp" className="animate-fade-in">
            <Card className="bg-card/80 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle>Active Positions</CardTitle>
              </CardHeader>
              <CardContent>
                {subaccount.positions.length === 0 ? (
                  <div className="text-muted-foreground text-center py-12 bg-secondary/10 rounded-lg border border-border/20">
                    <p>No active positions</p>
                    <p className="text-sm mt-1">Start trading by placing an order</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left py-3 text-muted-foreground">Market</th>
                          <th className="text-left py-3 text-muted-foreground">Direction</th>
                          <th className="text-left py-3 text-muted-foreground">Size</th>
                          <th className="text-left py-3 text-muted-foreground">Entry Price</th>
                          <th className="text-left py-3 text-muted-foreground">PnL</th>
                          <th className="text-left py-3 text-muted-foreground">Leverage</th>
                          {walletMode === 'connected' && <th className="text-right py-3 text-muted-foreground">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {subaccount.positions.map((position, i) => (
                          <tr key={i} className="border-b border-border/20 hover:bg-secondary/10">
                            <td className="py-3">{position.market}</td>
                            <td className={`py-3 ${position.direction === 'long' ? 'text-drift-green' : 'text-drift-red'}`}>
                              {position.direction === 'long' ? 'LONG' : 'SHORT'}
                            </td>
                            <td className="py-3">{position.size}</td>
                            <td className="py-3">${position.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className={`py-3 ${position.pnl >= 0 ? 'text-drift-green' : 'text-drift-red'}`}>
                              ${position.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-3">{position.leverage}x</td>
                            {walletMode === 'connected' && <td className="py-3 text-right">
                              <Button variant="destructive" size="sm" className="bg-drift-red/90 hover:bg-drift-red">Close</Button>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="orders" className="animate-fade-in">
            <Card className="bg-card/80 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle>Open Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {subaccount.openOrders.length === 0 ? (
                  <div className="text-muted-foreground text-center py-12 bg-secondary/10 rounded-lg border border-border/20">
                    <p>No open orders</p>
                    <p className="text-sm mt-1">Place an order to start trading</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left py-3 text-muted-foreground">Market</th>
                          <th className="text-left py-3 text-muted-foreground">Type</th>
                          <th className="text-left py-3 text-muted-foreground">Direction</th>
                          <th className="text-left py-3 text-muted-foreground">Price</th>
                          <th className="text-left py-3 text-muted-foreground">Size</th>
                          <th className="text-left py-3 text-muted-foreground">Status</th>
                          {walletMode === 'connected' && <th className="text-right py-3 text-muted-foreground">Action</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {subaccount.openOrders.map((order) => (
                          <tr key={order.id} className="border-b border-border/20 hover:bg-secondary/10">
                            <td className="py-3">{order.market}</td>
                            <td className="py-3">{order.type.toUpperCase()}</td>
                            <td className={`py-3 ${order.direction === 'long' ? 'text-drift-green' : 'text-drift-red'}`}>
                              {order.direction === 'long' ? 'LONG' : 'SHORT'}
                            </td>
                            <td className="py-3">${order.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="py-3">{order.size}</td>
                            <td className="py-3">
                              <span className="px-2 py-1 rounded-full text-xs uppercase bg-emerald-500/20 text-emerald-400">
                                {order.status}
                              </span>
                            </td>
                            {walletMode === 'connected' && <td className="py-3 text-right">
                              <Button variant="destructive" size="sm" className="bg-drift-red/90 hover:bg-drift-red">Cancel</Button>
                            </td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="placed" className="animate-fade-in">
            <Card className="bg-card/80 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle>Placed Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground bg-secondary/10 rounded-lg border border-border/20 p-6">
                  <div className="max-w-md mx-auto text-center">
                    <p className="text-lg font-medium mb-2">Coming Soon</p>
                    <p className="mb-4">
                      Order placement will be implemented in the next phase of development
                    </p>
                    <div className="animate-pulse-glow text-primary">
                      <div className="inline-block px-4 py-2 rounded-full border border-primary/30 bg-primary/5">
                        Stay tuned for updates
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Modals */}
      <DepositModal />
      <WithdrawModal />
    </div>
  );
};

export default SubaccountDetail;
