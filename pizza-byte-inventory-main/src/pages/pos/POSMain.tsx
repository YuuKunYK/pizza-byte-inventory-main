import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { POSOrderBoard } from '@/components/pos/POSOrderBoard';
import { useTodaySalesSummary } from '@/hooks/usePOSAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/types/pos';
import { UtensilsCrossed, ShoppingBag, TrendingUp, DollarSign, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const POSMain = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'dining' | 'takeaway' | 'delivery'>('dining');
  const { todayRevenue, todayProfit, todayOrders, isLoading } = useTodaySalesSummary(
    user?.locationId
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Point of Sale</h1>
          <p className="text-muted-foreground">
            Orders, kitchen status, and live sales for {user?.locationName || 'this location'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/pos/analytics">View analytics</Link>
        </Button>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Today's Revenue</p>
              <p className="text-2xl font-bold text-primary">
                {isLoading ? '...' : formatCurrency(todayRevenue)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Estimated Profit</p>
              <p className="text-2xl font-bold text-green-600">
                {isLoading ? '...' : formatCurrency(todayProfit)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Orders Today</p>
              <p className="text-2xl font-bold">{isLoading ? '...' : todayOrders}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="dining" className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            Dine-In
          </TabsTrigger>
          <TabsTrigger value="takeaway" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Takeaway
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Delivery
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dining" className="mt-6">
          <POSOrderBoard orderType="dining" />
        </TabsContent>
        <TabsContent value="takeaway" className="mt-6">
          <POSOrderBoard orderType="takeaway" />
        </TabsContent>
        <TabsContent value="delivery" className="mt-6">
          <POSOrderBoard orderType="delivery" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default POSMain;
