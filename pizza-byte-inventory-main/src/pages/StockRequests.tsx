import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Check,
  Filter,
  Plus,
  Search,
  X,
  AlertCircle,
  Bell
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

// New interface for request items
interface RequestItem {
  item_id: string;
  quantity: number;
}

interface CreateMultiItemRequestParams {
  items: RequestItem[];
  to_location_id: string;
  from_location_id: string;
  notes?: string;
  requested_by: string;
  status: "pending" | "partial" | "fulfilled" | "rejected";
}

interface CreateStockRequestParams {
  item_id: string;
  to_location_id: string;
  from_location_id: string;
  requested_quantity: number;
  notes?: string;
  requested_by: string;
  status: "pending" | "partial" | "fulfilled" | "rejected";
  dispatched_quantity: number;
}

interface UpdateStockRequestParams {
  id: string;
  status: "pending" | "partial" | "fulfilled" | "rejected";
  dispatchedQuantity?: number;
}

// New interface for partial fulfillment dialog
interface PartialFulfillmentItem {
  itemId: string;
  itemName: string;
  requestedQuantity: number;
  maxAvailable: number;
  quantity: number;
  unit: string;
}

const StockRequests = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isNewRequestDialogOpen, setIsNewRequestDialogOpen] = useState(false);
  const [isPartialFulfillmentDialogOpen, setIsPartialFulfillmentDialogOpen] = useState(false);
  const [partialFulfillmentRequest, setPartialFulfillmentRequest] = useState(null);
  const [partialFulfillmentQuantity, setPartialFulfillmentQuantity] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [requestQuantity, setRequestQuantity] = useState('');
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [notes, setNotes] = useState('');
  const [editMode, setEditMode] = useState<string | null>(null); // Track which request is being edited
  
  // Notification state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsDialogOpen, setIsNotificationsDialogOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading: isLoadingLocations, refetch: refetchLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
    // Removed refetchInterval
  });

  const { data: inventoryItems = [], isLoading: isLoadingItems, refetch: refetchInventoryItems } = useQuery({
    queryKey: ['inventory_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, categories(name)')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
    // Removed refetchInterval
  });

  // Set up real-time subscriptions for locations and inventory items
  useEffect(() => {
    // Create subscription for locations
    const locationsSubscription = supabase
      .channel('locations_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'locations' 
        }, 
        () => {
          // Update locations data
          refetchLocations();
        }
      )
      .subscribe();

    // Create subscription for inventory items
    const itemsSubscription = supabase
      .channel('inventory_items_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'inventory_items' 
        }, 
        () => {
          // Update inventory items data
          refetchInventoryItems();
        }
      )
      .subscribe();

    // Cleanup subscriptions when component unmounts
    return () => {
      locationsSubscription.unsubscribe();
      itemsSubscription.unsubscribe();
    };
  }, [refetchLocations, refetchInventoryItems]);

  const { data: stockRequests = [], isLoading: isLoadingRequests, refetch: refetchStockRequests } = useQuery({
    queryKey: ['stock_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          *,
          item:inventory_items(id, name),
          from_location:locations!stock_requests_from_location_id_fkey(id, name),
          to_location:locations!stock_requests_to_location_id_fkey(id, name),
          requested_by_profile:profiles!stock_requests_requested_by_fkey(id, name),
          fulfilled_by_profile:profiles!stock_requests_fulfilled_by_fkey(id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
    // Removed refetchInterval to avoid polling
  });

  // Set up real-time subscription to stock_requests table
  useEffect(() => {
    // Create subscription for real-time updates
    const subscription = supabase
      .channel('stock_requests_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'stock_requests' 
        }, 
        async (payload) => {
          console.log('Stock request changed:', payload);
          
          // Handle different event types
          if (payload.eventType === 'INSERT') {
            // For newly inserted records, get the full data with relations
            const { data, error } = await supabase
              .from('stock_requests')
              .select(`
                *,
                item:inventory_items(id, name),
                from_location:locations!stock_requests_from_location_id_fkey(id, name),
                to_location:locations!stock_requests_to_location_id_fkey(id, name),
                requested_by_profile:profiles!stock_requests_requested_by_fkey(id, name),
                fulfilled_by_profile:profiles!stock_requests_fulfilled_by_fkey(id, name)
              `)
              .eq('id', payload.new.id)
              .single();
            
            if (!error && data) {
              // Update the cache directly
              queryClient.setQueryData(['stock_requests'], (oldData: any) => {
                if (!oldData) return [data];
                return [data, ...oldData];
              });
            }
          } 
          else if (payload.eventType === 'UPDATE') {
            // For updates, find and update the record in the cache
            queryClient.setQueryData(['stock_requests'], (oldData: any) => {
              if (!oldData) return oldData;
              
              return oldData.map((request) => {
                if (request.id === payload.new.id) {
                  // Update just the fields that changed in the existing record
                  return { ...request, ...payload.new };
                }
                return request;
              });
            });
          }
          else if (payload.eventType === 'DELETE') {
            // For deletions, remove the record from the cache
            queryClient.setQueryData(['stock_requests'], (oldData: any) => {
              if (!oldData) return oldData;
              return oldData.filter((request) => request.id !== payload.old.id);
            });
          }
        }
      )
      .subscribe();

    // Cleanup subscription when component unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const createRequestMutation = useMutation({
    mutationFn: async (newRequest: CreateStockRequestParams) => {
      const { data, error } = await supabase
        .from('stock_requests')
        .insert(newRequest)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
    },
    onError: (error) => {
      console.error('Error creating stock request:', error);
      toast.error('Failed to create stock request', {
        description: error.message
      });
    }
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, dispatchedQuantity = 0 }: UpdateStockRequestParams) => {
      const { data, error } = await supabase
        .from('stock_requests')
        .update({ 
          status,
          dispatched_quantity: dispatchedQuantity,
          fulfilled_by: user?.id
        })
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      queryClient.invalidateQueries({ queryKey: ['stock_entries'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      toast.success('Stock request updated successfully');
    },
    onError: (error) => {
      console.error('Error updating stock request:', error);
      toast.error('Failed to update stock request', {
        description: error.message
      });
    }
  });

  // Get current stock for an item at a location
  const getCurrentStock = useCallback(async (itemId: string, locationId: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('item_id', itemId)
        .eq('location_id', locationId)
        .single();
      
      if (error) {
        console.error('Error getting current stock:', error);
        return 0;
      }
      
      // Different stock fields might be used depending on your schema
      // Use appropriate field or calculated value
      const stockValue = 
        data?.closing_stock ?? 
        data?.opening_stock ?? 
        data?.warehouse_receiving ?? 0;
        
      return stockValue;
    } catch (error) {
      console.error('Error getting current stock:', error);
      return 0;
    }
  }, []);

  // Update stock in database
  const updateStockMutation = useMutation<
    { newQuantity: number },
    Error,
    { 
      itemId: string;
      locationId: string;
      quantity: number;
      isAddition: boolean;
    }
  >({
    mutationFn: async ({ itemId, locationId, quantity, isAddition = true }) => {
      // First, get current stock
      const currentStock = await getCurrentStock(itemId, locationId);
      
      // Calculate new stock value
      const newQuantity = isAddition 
        ? currentStock + quantity 
        : Math.max(0, currentStock - quantity);
      
      // Check if stock entry exists
      const { data: existingEntry } = await supabase
        .from('stock_entries')
        .select('id')
        .eq('item_id', itemId)
        .eq('location_id', locationId);
      
      if (existingEntry && existingEntry.length > 0) {
        // Update existing entry - use the correct field based on your schema
        const { error } = await supabase
          .from('stock_entries')
          .update({ closing_stock: newQuantity })
          .eq('item_id', itemId)
          .eq('location_id', locationId);
        
        if (error) throw error;
      } else {
        // Create new entry - use the correct fields based on your schema
        const { error } = await supabase
          .from('stock_entries')
          .insert({ 
            item_id: itemId, 
            location_id: locationId, 
            closing_stock: newQuantity,
            opening_stock: newQuantity 
          });
        
        if (error) throw error;
      }
      
      // Create activity log entry
      await supabase.from('activity_logs').insert({
        action: isAddition ? 'Stock Increased' : 'Stock Decreased',
        entity_type: 'inventory',
        entity_id: itemId,
        details: JSON.stringify({ 
          quantity: quantity,
          location_id: locationId,
          operation: isAddition ? 'addition' : 'subtraction'
        }),
        user_id: user?.id,
        location_id: locationId
      });
      
      return { newQuantity };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_entries'] });
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
    }
  });
  
  // Handle stock request fulfillment with inventory update
  const handleFulfillRequest = async (request, quantity, status) => {
    try {
      // Get details to make sure we have the latest data
      const { data, error } = await supabase
        .from('stock_requests')
        .select(`
          *,
          item:inventory_items(id, name)
        `)
        .eq('id', request.id)
        .single();
      
      if (error) throw error;
      
      // Validate sender has enough stock
      const senderCurrentStock = await getCurrentStock(data.item_id, data.from_location_id);
      
      if (senderCurrentStock < quantity) {
        toast.error('Not enough stock to fulfill this request', {
          description: `You only have ${senderCurrentStock} units available.`
        });
        return;
      }
      
      // 1. Update request status
      await updateRequestMutation.mutateAsync({ 
        id: request.id, 
        status, 
        dispatchedQuantity: quantity 
      });
      
      // 2. Decrease stock at sender's location
      await updateStockMutation.mutateAsync({
        itemId: data.item_id,
        locationId: data.from_location_id,
        quantity: quantity,
        isAddition: false
      });
      
      // 3. Increase stock at receiver's location
      await updateStockMutation.mutateAsync({
        itemId: data.item_id,
        locationId: data.to_location_id,
        quantity: quantity,
        isAddition: true
      });
      
      // Show success message
      toast.success(`Stock request ${status === 'fulfilled' ? 'fulfilled' : 'partially fulfilled'}`, {
        description: `${quantity} units of ${data.item?.name || 'Item'} have been transferred.`
      });
      
      // Close dialog if open
      setIsPartialFulfillmentDialogOpen(false);
      
      // Explicitly invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['stock_requests'] });
      queryClient.invalidateQueries({ queryKey: ['stock_entries'] });
      
    } catch (error) {
      console.error('Error fulfilling request:', error);
      toast.error('Failed to fulfill stock request', {
        description: error.message
      });
    }
  };

  const handleUpdateStatus = async (id, status, requestedQuantity = 0) => {
    if (status === 'fulfilled') {
      // For full fulfillment
      const request = stockRequests.find(r => r.id === id);
      await handleFulfillRequest(request, request.requested_quantity, 'fulfilled');
    } else if (status === 'partial') {
      // For partial fulfillment, open dialog
      const request = stockRequests.find(r => r.id === id);
      setPartialFulfillmentRequest(request);
      
      // Set initial value to half of requested quantity
      const initialValue = Math.floor(request.requested_quantity / 2);
      setPartialFulfillmentQuantity(initialValue);
      
      setIsPartialFulfillmentDialogOpen(true);
    } else if (status === 'rejected') {
      // Just update the status for rejection
      updateRequestMutation.mutate({ 
        id, 
        status: 'rejected',
        dispatchedQuantity: 0
      });
    }
  };

  const handlePartialFulfill = async () => {
    if (!partialFulfillmentRequest) return;
    
    await handleFulfillRequest(
      partialFulfillmentRequest, 
      partialFulfillmentQuantity, 
      'partial'
    );
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    
    if (requestItems.length === 0 || !selectedLocation) {
      toast.error('Please add at least one item and select a location');
      return;
    }

    try {
      let successCount = 0;
      
      // Create multiple requests, one for each item
      for (const item of requestItems) {
        try {
          const requestData: CreateStockRequestParams = {
            item_id: item.item_id,
            to_location_id: user?.locationId,
            from_location_id: selectedLocation,
            requested_quantity: item.quantity,
            notes,
            requested_by: user?.id,
            status: "pending",
            dispatched_quantity: 0
          };
          
          await createRequestMutation.mutateAsync(requestData);
          successCount++;
        } catch (itemError) {
          // Individual item errors are handled by the mutation
          console.error('Error creating request for item:', item, itemError);
        }
      }
      
      if (successCount > 0) {
        // Close dialog and show success message
        setIsNewRequestDialogOpen(false);
        toast.success(`${successCount} of ${requestItems.length} stock request(s) created successfully`);
        
        // Reset form
        resetForm();
      } else {
        toast.error('Failed to create any stock requests');
      }
    } catch (error) {
      console.error('Error creating stock requests:', error);
      toast.error('An unexpected error occurred while creating stock requests');
    }
  };

  const resetForm = () => {
    setSelectedItem('');
    setSelectedLocation('');
    setRequestQuantity('');
    setRequestItems([]);
    setNotes('');
  };

  const filteredRequests = stockRequests.filter(request => {
    const matchesSearch = 
      request.item?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.from_location?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.to_location?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'pending': return 'outline';
      case 'partial': return 'secondary';
      case 'fulfilled': return 'default';
      case 'rejected': return 'destructive';
      default: return 'outline';
    }
  };

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('entity_type', 'stock_request')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }
      
      // Convert activity logs to a notification format
      const convertedNotifications = (data || []).map(log => {
        const details = typeof log.details === 'string'
          ? JSON.parse(log.details as string)
          : (log.details || {});
          
        return {
          id: log.id,
          user_id: log.user_id,
          title: details.title || log.action,
          message: details.message || `${log.action} on ${log.entity_type} ${log.entity_id}`,
          type: details.type || 'info',
          related_to: log.entity_type,
          related_id: log.entity_id,
          is_read: details.is_read || false,
          created_at: log.created_at
        };
      });
      
      setNotifications(convertedNotifications);
      setUnreadCount(convertedNotifications.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error parsing notifications:', error);
    }
  }, [user]);

  // Mark notification as read
  const markNotificationAsRead = async (notificationId) => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) return;
      
      // Update details field with is_read true
      const details = typeof notification.details === 'string' 
        ? JSON.parse(notification.details as string)
        : (notification.details || {});
      
      const updatedDetails = { ...details, is_read: true };
      
      const { error } = await supabase
        .from('activity_logs')
        .update({ 
          details: updatedDetails
        })
        .eq('id', notificationId);
      
      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, is_read: true } 
            : n
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Dismiss all notifications
  const dismissAllNotifications = async () => {
    try {
      // Update all notifications for this user
      const unreadNotifications = notifications.filter(n => !n.is_read);
      
      for (const notification of unreadNotifications) {
        const details = typeof notification.details === 'string'
          ? JSON.parse(notification.details as string)
          : (notification.details || {});
        
        const updatedDetails = { ...details, is_read: true };
        
        await supabase
          .from('activity_logs')
          .update({ 
            details: updatedDetails 
          })
          .eq('id', notification.id);
      }
      
      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      
      setUnreadCount(0);
    } catch (error) {
      console.error('Error dismissing notifications:', error);
    }
  };

  // Load notifications on component mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  // Subscribe to activity logs for notifications
  useEffect(() => {
    if (!user) return;
    
    const subscription = supabase
      .channel('activity_logs_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        // Refresh notifications when a new activity log is created
        fetchNotifications();
        
        // Show a toast notification for the new log
        const details = typeof payload.new.details === 'string'
          ? JSON.parse(payload.new.details as string)
          : (payload.new.details || {});
        
        if (details.title) {
          toast(details.title, {
            description: details.message || '',
          });
        }
      })
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [user, fetchNotifications]);

  if (isLoadingRequests || isLoadingLocations || isLoadingItems) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading stock requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Stock Requests</h1>
        <p className="text-muted-foreground">
          Request stock items from warehouse or other branches.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:w-[250px]"
            />
          </div>
          
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partially Fulfilled</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 relative"
            onClick={() => setIsNotificationsDialogOpen(true)}
          >
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                {unreadCount}
              </span>
            )}
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </Button>
          <Button onClick={() => setIsNewRequestDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:hidden">
        {filteredRequests.length > 0 ? (
          filteredRequests.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base font-medium">
                    {request.item?.name}
                  </CardTitle>
                  <Badge variant={getStatusBadgeVariant(request.status)}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-muted-foreground">From:</span>
                  <span>{request.from_location?.name}</span>
                  <span className="text-muted-foreground">To:</span>
                  <span>{request.to_location?.name}</span>
                  <span className="text-muted-foreground">Quantity:</span>
                  <span>{request.requested_quantity}</span>
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(request.created_at).toLocaleDateString()}</span>
                </div>
                {request.notes && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Notes: </span>
                    <span>{request.notes}</span>
                  </div>
                )}
                {request.status === 'pending' && user?.locationId === request.from_location?.id && (
                  <div className="flex justify-end gap-2 mt-4">
                    {editMode === request.id ? (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setEditMode(null)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateStatus(request.id, 'rejected')}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUpdateStatus(request.id, 'partial', request.requested_quantity)}
                        >
                          Partial
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleUpdateStatus(request.id, 'fulfilled', request.requested_quantity)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Fulfill
                        </Button>
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditMode(request.id)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground">No stock requests found.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="hidden md:block">
        <Card>
          <CardHeader className="py-4">
            <CardTitle>Stock Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Requested Qty</TableHead>
                  <TableHead>Dispatched Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">{request.item?.name}</TableCell>
                      <TableCell>{request.from_location?.name}</TableCell>
                      <TableCell>{request.to_location?.name}</TableCell>
                      <TableCell>{request.requested_quantity}</TableCell>
                      <TableCell>{request.dispatched_quantity || 0}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {request.status === 'pending' && user?.locationId === request.from_location?.id && (
                          <div className="flex space-x-2">
                            {editMode === request.id ? (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setEditMode(null)}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleUpdateStatus(request.id, 'rejected')}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleUpdateStatus(request.id, 'partial', request.requested_quantity)}
                                >
                                  Partial
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={() => handleUpdateStatus(request.id, 'fulfilled', request.requested_quantity)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Fulfill
                                </Button>
                              </>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setEditMode(request.id)}
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      No stock requests found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isNewRequestDialogOpen} onOpenChange={setIsNewRequestDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Stock Request</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequest}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm font-medium">Request From</label>
                  <Select
                    value={selectedLocation}
                    onValueChange={setSelectedLocation}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations
                        .filter(location => location.id !== user?.locationId)
                        .map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} ({location.type})
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="border rounded-md p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium">Items</h3>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedItem}
                        onValueChange={setSelectedItem}
                        disabled={!selectedLocation}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.categories?.name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        pattern="\d*"
                        placeholder="Qty"
                        className="w-[80px]"
                        value={requestQuantity}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || /^\d+$/.test(value)) {
                            setRequestQuantity(value);
                          }
                        }}
                        disabled={!selectedItem}
                      />
                      
                      <Button 
                        type="button" 
                        size="sm"
                        variant="secondary"
                        disabled={!selectedItem || !requestQuantity}
                        onClick={() => {
                          // Add item to the list
                          if (selectedItem && requestQuantity) {
                            const itemToAdd = inventoryItems.find(item => item.id === selectedItem);
                            if (itemToAdd) {
                              setRequestItems(prev => [
                                ...prev, 
                                { 
                                  item_id: selectedItem, 
                                  quantity: parseInt(requestQuantity) 
                                }
                              ]);
                              setSelectedItem('');
                              setRequestQuantity('');
                            }
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                  
                  {requestItems.length > 0 ? (
                    <div className="border rounded-md overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {requestItems.map((item, index) => {
                            const itemData = inventoryItems.find(i => i.id === item.item_id);
                            return (
                              <TableRow key={index}>
                                <TableCell>{itemData?.name}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => {
                                      setRequestItems(prev => 
                                        prev.filter((_, i) => i !== index)
                                      );
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No items added yet. Select items and quantities above.
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="text-sm font-medium">Notes (Optional)</label>
                  <Textarea
                    placeholder="Add any additional notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setIsNewRequestDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createRequestMutation.isPending || requestItems.length === 0 || !selectedLocation}
              >
                {createRequestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="mr-2 h-4 w-4" />
                    Create Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Partial Fulfillment Dialog */}
      <Dialog open={isPartialFulfillmentDialogOpen} onOpenChange={setIsPartialFulfillmentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Partially Fulfill Request</DialogTitle>
          </DialogHeader>
          
          {partialFulfillmentRequest && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col space-y-1.5">
                <h3 className="text-sm font-medium">
                  Request for {partialFulfillmentRequest.item?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Requested quantity: {partialFulfillmentRequest.requested_quantity}
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="quantity">Quantity to fulfill</Label>
                    <span className="text-sm text-muted-foreground">
                      {partialFulfillmentQuantity} of {partialFulfillmentRequest.requested_quantity}
                    </span>
                  </div>
                  
                  <Slider
                    id="quantity"
                    value={[partialFulfillmentQuantity]}
                    max={partialFulfillmentRequest.requested_quantity}
                    min={1}
                    step={1}
                    onValueChange={(value) => setPartialFulfillmentQuantity(Math.round(value[0]))}
                    className="py-4"
                  />
                </div>
                
                <div className="flex justify-between text-sm">
                  <span>Min: 1</span>
                  <span>Max: {partialFulfillmentRequest.requested_quantity}</span>
                </div>

                <div className="rounded-md bg-yellow-50 p-3 text-sm flex items-start">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-yellow-700">
                    <p>
                      Stock will be automatically transferred from your inventory to the requester's location.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPartialFulfillmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePartialFulfill}
              disabled={!partialFulfillmentRequest || partialFulfillmentQuantity < 1}
            >
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications Dialog */}
      <Dialog open={isNotificationsDialogOpen} onOpenChange={setIsNotificationsDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={dismissAllNotifications}
                >
                  Mark All as Read
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[400px] -mx-6 px-6">
            {notifications.length > 0 ? (
              <div className="space-y-4 py-2">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-3 rounded-md border ${notification.is_read ? 'bg-background' : 'bg-muted border-primary'}`}
                    onClick={() => !notification.is_read && markNotificationAsRead(notification.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium">{notification.title}</h4>
                        <p className="text-xs text-muted-foreground">{notification.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!notification.is_read && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNotificationsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockRequests;
