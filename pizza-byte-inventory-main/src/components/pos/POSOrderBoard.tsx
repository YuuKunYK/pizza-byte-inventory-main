import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { OrderCard } from '@/components/pos/OrderCard';
import { OrderDetailPanel } from '@/components/pos/OrderDetailPanel';
import { usePOSSales } from '@/hooks/usePOSSales';
import { useAuth } from '@/hooks/useAuth';
import { POSSaleWithDetails, OrderStatus } from '@/types/pos';
import { toast } from '@/hooks/use-toast';
import { getTodayRange } from '@/lib/pos-utils';
import { Loader2 } from 'lucide-react';

interface POSOrderBoardProps {
  orderType: 'dining' | 'takeaway' | 'delivery';
}

export const POSOrderBoard: React.FC<POSOrderBoardProps> = ({ orderType }) => {
  const { user } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<POSSaleWithDetails | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { sales, isLoadingSales, updateOrderStatus, isUpdating, refetch } = usePOSSales({
    ...getTodayRange(),
    branch_id: user?.locationId,
    order_type: orderType,
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refetch();
    }, 15000);
    return () => window.clearInterval(interval);
  }, [refetch]);

  const filteredOrders = sales.filter((order) => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.table_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const handleNewOrder = () => {
    const width = 1200;
    const height = 800;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    window.open(
      `/pos/new-order?type=${orderType}`,
      `NewOrder-${orderType}`,
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleUpdateStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const updated = await updateOrderStatus(orderId, status);
      setSelectedOrder((current) =>
        current?.id === orderId ? { ...current, ...updated } : current
      );
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoadingSales) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  const searchPlaceholder =
    orderType === 'dining'
      ? 'Search by order#, table, or customer...'
      : 'Search by order# or customer...';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Button onClick={handleNewOrder} size="lg" className="md:w-auto">
          <Plus className="mr-2 h-5 w-5" />
          New Order
        </Button>

        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="preparing">Preparing</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="served">Served</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">No orders found</p>
              <p className="text-sm">Click "New Order" to create your first order</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
                isSelected={selectedOrder?.id === order.id}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          <OrderDetailPanel
            order={selectedOrder}
            onUpdateStatus={handleUpdateStatus}
            isUpdating={isUpdating}
          />
        </div>
      </div>
    </div>
  );
};
