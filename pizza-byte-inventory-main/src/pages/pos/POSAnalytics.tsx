import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePOSAnalytics } from '@/hooks/usePOSAnalytics';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/types/pos';
import { getTodayRange, getLastNDaysRange } from '@/lib/pos-utils';
import { TrendingUp, DollarSign, ShoppingCart, Package, FileDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const POSAnalytics = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');

  // Get date range based on selection
  const getFilters = () => {
    const baseFilters = {
      branch_id: user?.role === 'admin' ? undefined : user?.locationId,
    };

    switch (dateRange) {
      case 'today':
        return { ...baseFilters, ...getTodayRange() };
      case 'week':
        return { ...baseFilters, ...getLastNDaysRange(7) };
      case 'month':
        return { ...baseFilters, ...getLastNDaysRange(30) };
      default:
        return baseFilters;
    }
  };

  const { analytics, isLoadingAnalytics } = usePOSAnalytics(getFilters());

  if (isLoadingAnalytics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Sales Analytics</h1>
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
        <p className="text-muted-foreground">
          Comprehensive sales analytics and performance metrics
        </p>
      </div>

      <Separator />

      {/* Date Range Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Time Period:</span>
        <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(analytics?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From {analytics?.totalOrders || 0} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(analytics?.totalProfit || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics?.totalRevenue
                ? ((analytics.totalProfit / analytics.totalRevenue) * 100).toFixed(1)
                : 0}
              % margin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.averageOrderValue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Tabs defaultValue="top-selling" className="w-full">
        <TabsList>
          <TabsTrigger value="top-selling">Top Selling</TabsTrigger>
          <TabsTrigger value="low-margin">Low Margin</TabsTrigger>
          <TabsTrigger value="order-types">Order Types</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        </TabsList>

        {/* Top Selling Items */}
        <TabsContent value="top-selling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Items</CardTitle>
              <CardDescription>Best performing products by revenue</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.topSellingItems && analytics.topSellingItems.length > 0 ? (
                <div className="space-y-3">
                  {analytics.topSellingItems.map((item, index) => (
                    <div key={item.item_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-8 h-8 flex items-center justify-center">
                          #{index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{item.item_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.quantity_sold} units sold
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Margin Items */}
        <TabsContent value="low-margin" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Low Margin Items</CardTitle>
              <CardDescription>Items with the lowest profit margins</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.lowMarginItems && analytics.lowMarginItems.length > 0 ? (
                <div className="space-y-3">
                  {analytics.lowMarginItems.map((item) => (
                    <div key={item.item_id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.total_sold} units sold
                        </p>
                      </div>
                      <Badge
                        variant={item.margin_percentage < 20 ? 'destructive' : 'secondary'}
                      >
                        {item.margin_percentage.toFixed(1)}% margin
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order Types */}
        <TabsContent value="order-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Order Type</CardTitle>
              <CardDescription>Breakdown of sales by dining and takeaway</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.salesByOrderType && analytics.salesByOrderType.length > 0 ? (
                <div className="space-y-3">
                  {analytics.salesByOrderType.map((type) => (
                    <div key={type.order_type} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">{type.order_type}</p>
                        <p className="text-sm text-muted-foreground">{type.count} orders</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(type.revenue)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Methods */}
        <TabsContent value="payment-methods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales by Payment Method</CardTitle>
              <CardDescription>Breakdown of sales by payment type</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics?.salesByPaymentMethod && analytics.salesByPaymentMethod.length > 0 ? (
                <div className="space-y-3">
                  {analytics.salesByPaymentMethod.map((method) => (
                    <div key={method.payment_method} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium capitalize">{method.payment_method}</p>
                        <p className="text-sm text-muted-foreground">{method.count} transactions</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(method.revenue)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default POSAnalytics;

