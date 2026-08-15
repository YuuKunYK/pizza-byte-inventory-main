import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePOSAnalytics, useSalesTrends } from '@/hooks/usePOSAnalytics';
import { useInventory } from '@/hooks/useInventory';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/types/pos';
import { getLastNDaysRange, getTodayRange } from '@/lib/pos-utils';
import { UserRole } from '@/types/auth';
import { Loader2 } from 'lucide-react';

const Reports = () => {
  const { user } = useAuth();
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week');
  const { inventoryItems, getTotalStock, getStockStatus, isLoadingItems, isLoadingStock } =
    useInventory();

  const filters = useMemo(() => {
    const base = {
      branch_id: user?.role === UserRole.ADMIN ? undefined : user?.locationId,
    };
    if (range === 'today') return { ...base, ...getTodayRange() };
    if (range === 'month') return { ...base, ...getLastNDaysRange(30) };
    return { ...base, ...getLastNDaysRange(7) };
  }, [range, user?.role, user?.locationId]);

  const { analytics, isLoadingAnalytics } = usePOSAnalytics(filters);
  const { trends, isLoadingTrends } = useSalesTrends(filters);

  const lowStock = inventoryItems.filter((item: any) => {
    const status = getStockStatus(item);
    return status === 'low' || status === 'critical';
  });

  const inventoryValue = inventoryItems.reduce((total: number, item: any) => {
    return total + item.cost_per_unit * getTotalStock(item.id);
  }, 0);

  if (isLoadingAnalytics || isLoadingItems || isLoadingStock) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Building reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Sales, profit, and stock health for {user?.locationName || 'all locations'}
          </p>
        </div>
        <Select value={range} onValueChange={(value: typeof range) => setRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatCurrency(analytics?.totalRevenue || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold text-green-600">
            {formatCurrency(analytics?.totalProfit || 0)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{analytics?.totalOrders || 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inventory value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            PKR {inventoryValue.toLocaleString()}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top selling items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(analytics?.topSellingItems || []).slice(0, 8).map((item) => (
              <div key={item.item_id} className="flex justify-between text-sm">
                <span>
                  {item.item_name} × {item.quantity_sold}
                </span>
                <span className="font-medium">{formatCurrency(item.revenue)}</span>
              </div>
            ))}
            {!analytics?.topSellingItems?.length && (
              <p className="text-sm text-muted-foreground">No completed sales in this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.slice(0, 8).map((item: any) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name}</span>
                <span className="font-medium">
                  {getTotalStock(item.id)} {item.unit_type}
                </span>
              </div>
            ))}
            {!lowStock.length && (
              <p className="text-sm text-muted-foreground">All tracked items are above threshold.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily sales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoadingTrends ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            trends.map((day) => (
              <div key={day.date} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{day.date}</span>
                <div className="flex gap-6">
                  <span>{day.orders} orders</span>
                  <span className="font-medium">{formatCurrency(day.revenue)}</span>
                </div>
              </div>
            ))
          )}
          {!trends.length && (
            <p className="text-sm text-muted-foreground">No sales recorded for this range.</p>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">
            Cancelled orders are excluded. Recipe-linked dishes reduce branch stock when sold.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
