import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useAuth } from './useAuth';
import { UnitType } from '@/types/inventory';
import { UserRole } from '@/types/auth';

interface CreateItemParams {
  name: string;
  category_id: string;
  unit_type: UnitType;
  cost_per_unit: number;
  min_stock_threshold?: number;
  conversion_value?: number;
}

interface UpdateItemParams {
  id: string;
  name?: string;
  category_id?: string;
  unit_type?: UnitType;
  cost_per_unit?: number;
  min_stock_threshold?: number;
  conversion_value?: number;
}

interface UpdateStockParams {
  itemId: string;
  locationId: string;
  updateData: {
    opening_stock?: number;
    warehouse_receiving?: number;
    local_purchasing?: number;
    transfer_in?: number;
    transfer_out?: number;
    discarded?: number;
    closing_stock?: number;
    updated_at?: string;
  };
}

export const useInventory = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  const { 
    data: inventoryItems = [], 
    isLoading: isLoadingItems,
    isError: isItemsError,
    error: itemsError
  } = useQuery({
    queryKey: ['inventory_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*, category:categories(id, name)')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { 
    data: categories = [], 
    isLoading: isLoadingCategories 
  } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { 
    data: locations = [], 
    isLoading: isLoadingLocations 
  } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { 
    data: stockEntries = [], 
    isLoading: isLoadingStock,
    isError: isStockError,
    error: stockError
  } = useQuery({
    queryKey: ['stock_entries', user?.locationId, selectedLocation],
    queryFn: async () => {
      try {
        let query = supabase
          .from('stock_entries')
          .select('*')
          .order('date', { ascending: false });

        // If user is not admin, they can only see their own location's data
        if (user?.role !== UserRole.ADMIN) {
          query = query.eq('location_id', user?.locationId);
        } else if (selectedLocation) {
          // If admin has selected a specific location
          query = query.eq('location_id', selectedLocation);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching stock entries:', error);
          return [];
        }
        
        return data || [];
      } catch (error) {
        console.error('Unexpected error in stock entries query:', error);
        return [];
      }
    },
    enabled: !!inventoryItems.length && !!user,
    retry: 2,
    retryDelay: 1000
  });

  const createItemMutation = useMutation({
    mutationFn: async (newItem: CreateItemParams) => {
      const { data, error } = await supabase
        .from('inventory_items')
        .insert(newItem)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      setIsAddDialogOpen(false);
      toast.success('Inventory item created successfully');
    },
    onError: (error) => {
      console.error('Error creating inventory item:', error);
      toast.error('Failed to create inventory item', {
        description: error.message
      });
    }
  });

  const updateItemMutation = useMutation({
    mutationFn: async (updatedItem: UpdateItemParams) => {
      const { id, ...itemData } = updatedItem;
      const { data, error } = await supabase
        .from('inventory_items')
        .update(itemData)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      setSelectedItem(null);
      toast.success('Inventory item updated successfully');
    },
    onError: (error) => {
      console.error('Error updating inventory item:', error);
      toast.error('Failed to update inventory item', {
        description: error.message
      });
    }
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ itemId, locationId, updateData }: UpdateStockParams) => {
      try {
        // Check if user has permission to update this location's stock
        if (user?.role !== UserRole.ADMIN && locationId !== user?.locationId) {
          throw new Error('You do not have permission to update stock for this location');
        }

        const today = new Date().toISOString().split('T')[0];
        
        // First, verify the item and location exist
        const { data: itemData, error: itemError } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('id', itemId)
          .single();

        if (itemError) {
          throw new Error('Item not found');
        }

        const { data: locationData, error: locationError } = await supabase
          .from('locations')
          .select('id')
          .eq('id', locationId)
          .single();

        if (locationError) {
          throw new Error('Location not found');
        }

        // Check for existing entry
        const { data: existingEntry, error: fetchError } = await supabase
          .from('stock_entries')
          .select('*')
          .eq('item_id', itemId)
          .eq('location_id', locationId)
          .eq('date', today)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }

        let result;
        
        if (existingEntry) {
          const { data, error } = await supabase
            .from('stock_entries')
            .update({
              ...updateData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingEntry.id)
            .select();
          
          if (error) {
            if (error.code === '42P17') {
              throw new Error('Permission error: Please contact your administrator');
            }
            throw error;
          }
          result = data;
        } else {
          const { data, error } = await supabase
            .from('stock_entries')
            .insert({
              item_id: itemId,
              location_id: locationId,
              date: today,
              opening_stock: 0,
              ...updateData
            })
            .select();
          
          if (error) {
            if (error.code === '42P17') {
              throw new Error('Permission error: Please contact your administrator');
            }
            throw error;
          }
          result = data;
        }
        
        return result;
      } catch (error) {
        console.error('Error in updateStockMutation:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock_entries'] });
      setIsUpdateStockDialogOpen(false);
      setSelectedItem(null);
      toast.success('Stock updated successfully');
    },
    onError: (error) => {
      console.error('Error updating stock:', error);
      toast.error('Failed to update stock', {
        description: error.message || 'An unexpected error occurred'
      });
    }
  });

  const getCurrentStock = (itemId, locationId) => {
    const entries = stockEntries.filter(
      entry => entry.item_id === itemId && entry.location_id === locationId
    );

    if (!entries.length) return 0;
    
    const latestEntry = entries.reduce((latest, entry) => {
      return new Date(entry.date) > new Date(latest.date) ? entry : latest;
    }, entries[0]);
    
    return latestEntry.closing_stock || 0;
  };

  const getTotalStock = (itemId) => {
    // If viewing all locations, sum up all locations' stock
    if (user?.role === UserRole.ADMIN && !selectedLocation) {
      return locations.reduce((total, location) => {
        return total + getCurrentStock(itemId, location.id);
      }, 0);
    }
    
    // Otherwise, just return the current location's stock
    return getCurrentStock(itemId, selectedLocation || user?.locationId);
  };

  const getStockStatus = (item) => {
    const totalStock = getTotalStock(item.id);
    if (totalStock <= item.min_stock_threshold * 0.5) return 'critical';
    if (totalStock <= item.min_stock_threshold) return 'low';
    return 'normal';
  };

  return {
    inventoryItems,
    categories,
    locations,
    stockEntries,
    isLoadingItems,
    isLoadingCategories,
    isLoadingLocations,
    isLoadingStock,
    isItemsError,
    itemsError,
    isStockError,
    stockError,
    isAddDialogOpen,
    setIsAddDialogOpen,
    isUpdateStockDialogOpen,
    setIsUpdateStockDialogOpen,
    selectedItem,
    setSelectedItem,
    selectedLocation,
    setSelectedLocation,
    createItem: (item: CreateItemParams) => createItemMutation.mutate(item),
    updateItem: (item: UpdateItemParams) => updateItemMutation.mutate(item),
    updateStock: (params: UpdateStockParams) => updateStockMutation.mutate(params),
    getCurrentStock,
    getTotalStock,
    getStockStatus,
    isCreatingItem: createItemMutation.isPending,
    isUpdatingItem: updateItemMutation.isPending,
    isUpdatingStock: updateStockMutation.isPending
  };
};
