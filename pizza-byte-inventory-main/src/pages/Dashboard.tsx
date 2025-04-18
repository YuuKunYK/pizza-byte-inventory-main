import React from 'react';
import { 
  AlertCircle, 
  ArrowDown, 
  ArrowUp, 
  Box, 
  Layers, 
  Package, 
  ShoppingCart,
  Check
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useInventory } from '@/hooks/useInventory';
import NotificationsPanel from '@/components/NotificationsPanel';
import { useNotifications } from '@/contexts/NotificationsContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, markAsRead, markAllAsRead, clearNotification } = useNotifications();
  const { 
    inventoryItems, 
    categories,
    locations,
    isLoadingItems,
    isLoadingCategories,
    isLoadingLocations,
    isLoadingStock,
    getStockStatus,
    getTotalStock,
    getCurrentStock
  } = useInventory();

  const { 
    data: stockRequests = [], 
    isLoading: isLoadingRequests 
  } = useQuery({
    queryKey: ['stock_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          *,
          item:inventory_items(id, name),
          from_location:locations!stock_requests_from_location_id_fkey(id, name),
          to_location:locations!stock_requests_to_location_id_fkey(id, name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    }
  });

  const { 
    data: activityLogs = [], 
    isLoading: isLoadingLogs 
  } = useQuery({
    queryKey: ['activity_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Calculate inventory stats
  const totalInventoryValue = inventoryItems.reduce((total, item) => {
    return total + (item.cost_per_unit * getCurrentStock(item.id, user?.locationId));
  }, 0);

  const categoriesCount = categories.length;
  
  const pendingRequestsCount = stockRequests.length;
  
  // Calculate low stock items for current location
  const lowStockItems = inventoryItems
    .filter(item => {
      const stock = getCurrentStock(item.id, user?.locationId);
      const status = getStockStatus(item);
      return (status === 'low' || status === 'critical') && stock > 0;
    })
    .slice(0, 3)
    .map(item => ({
      id: item.id,
      name: item.name,
      stock: getCurrentStock(item.id, user?.locationId),
      threshold: item.min_stock_threshold,
      unit: item.unit_type
    }));

  // Loading state
  if (isLoadingItems || isLoadingCategories || isLoadingLocations || isLoadingStock || isLoadingRequests || isLoadingLogs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your inventory, requests, and recent activity.
        </p>
      </div>

      <Separator />

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">PKR {totalInventoryValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className="flex items-center">
                <Box className="mr-1 h-3 w-3" />
                {user?.role === 'admin' 
                  ? 'Across all locations'
                  : `At ${locations.find(l => l.id === user?.locationId)?.name || 'your location'}`}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Items</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventoryItems.length}</div>
            <p className="text-xs text-muted-foreground">
              <span className="flex items-center">
                <Box className="mr-1 h-3 w-3" />
                Across {categoriesCount} categories
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequestsCount}</div>
            <p className="text-xs text-muted-foreground">
              <span className={`flex items-center ${pendingRequestsCount === 0 ? 'text-green-500' : 'text-amber-500'}`}>
                {pendingRequestsCount === 0 ? (
                  <Check className="mr-1 h-3 w-3" />
                ) : (
                  <AlertCircle className="mr-1 h-3 w-3" />
                )}
                {pendingRequestsCount === 0 ? 'No action needed' : 'Waiting for action'}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {inventoryItems.filter(item => {
                const stock = getCurrentStock(item.id, user?.locationId);
                const status = getStockStatus(item);
                return (status === 'low' || status === 'critical') && stock > 0;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className={`flex items-center ${lowStockItems.length === 0 ? 'text-green-500' : 'text-red-500'}`}>
                {lowStockItems.length === 0 ? (
                  <Check className="mr-1 h-3 w-3" />
                ) : (
                  <ArrowDown className="mr-1 h-3 w-3" />
                )}
                {lowStockItems.length === 0 ? 'No action needed' : 'Below threshold'}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Low stock alerts */}
        <Card className="md:col-span-1 card-hover">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Low Stock Alerts</CardTitle>
              <CardDescription>Items below threshold</CardDescription>
            </div>
            {lowStockItems.length === 0 ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockItems.length > 0 ? (
                lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.stock} {item.unit} remaining
                      </p>
                    </div>
                    <div className="text-xs font-medium text-destructive">
                      {Math.round((item.stock / item.threshold) * 100)}% of min
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-green-500">
                  <p>No low stock items</p>
                </div>
              )}
              <Button 
                variant="outline" 
                className="w-full mt-2"
                onClick={() => navigate('/inventory')}
              >
                View All Inventory
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Panel */}
        <Card className="md:col-span-1 card-hover">
          <NotificationsPanel 
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onClearNotification={clearNotification}
          />
        </Card>

        {/* Pending requests */}
        <Card className="md:col-span-1 card-hover">
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>Stock requests waiting for action</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stockRequests.length > 0 ? (
                <>
                  {stockRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">From: {request.from_location?.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.requested_quantity} {request.item?.name} • {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigate('/requests')}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="py-4 text-center text-green-500">
                  <p>No pending requests</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="md:col-span-3 lg:col-span-3 card-hover">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across branches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityLogs.length > 0 ? (
                <>
                  {activityLogs.map((activity) => (
                    <div key={activity.id} className="flex flex-col space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{activity.action}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {activity.entity_type} • {activity.user_id ? 'User' : 'System'}
                      </p>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    className="w-full mt-2"
                    onClick={() => navigate('/logs')}
                  >
                    View All Activity
                  </Button>
                </>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
