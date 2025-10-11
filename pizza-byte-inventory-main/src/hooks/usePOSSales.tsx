import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { POSSale, POSSaleWithDetails, CreateSaleInput, SalesFilters } from '@/types/pos';
import { toast } from '@/hooks/use-toast';
import { useAuth } from './useAuth';

/**
 * Hook to manage POS sales operations
 */
export const usePOSSales = (filters?: SalesFilters) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch sales with filters
  const {
    data: sales = [],
    isLoading: isLoadingSales,
    error: salesError,
  } = useQuery<POSSaleWithDetails[]>({
    queryKey: ['pos_sales', filters],
    queryFn: async () => {
      let query = supabase
        .from('pos_sales')
        .select(`
          *,
          branch:locations(id, name),
          cashier:auth.users(id, email)
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.branch_id) {
        query = query.eq('branch_id', filters.branch_id);
      }

      if (filters?.order_type) {
        query = query.eq('order_type', filters.order_type);
      }

      if (filters?.payment_method) {
        query = query.eq('payment_method', filters.payment_method);
      }

      if (filters?.cashier_id) {
        query = query.eq('cashier_id', filters.cashier_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  // Get single sale by ID
  const getSale = async (id: string): Promise<POSSaleWithDetails | null> => {
    const { data, error } = await supabase
      .from('pos_sales')
      .select(`
        *,
        branch:locations(id, name),
        cashier:auth.users(id, email)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching sale:', error);
      return null;
    }

    return data;
  };

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      const { data, error } = await supabase
        .from('pos_sales')
        .insert({
          items: input.items,
          subtotal: input.subtotal,
          discount_type: input.discount_type,
          discount_value: input.discount_value,
          discount_amount: input.discount_amount,
          tax: input.tax,
          total_amount: input.total_amount,
          profit: input.profit,
          payment_method: input.payment_method,
          order_type: input.order_type,
          branch_id: input.branch_id,
          cashier_id: input.cashier_id,
          notes: input.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos_sales'] });
      queryClient.invalidateQueries({ queryKey: ['pos_analytics'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] }); // Refresh inventory after sale
      toast({
        title: 'Sale Completed',
        description: `Order ${data.order_number} has been processed successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sale Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update sale mutation (for admin corrections and status updates)
  const updateSaleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateSaleInput> | { status: string } }) => {
      const { data, error } = await supabase
        .from('pos_sales')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_sales'] });
      queryClient.invalidateQueries({ queryKey: ['pos_analytics'] });
      toast({
        title: 'Order Updated',
        description: 'Order has been updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update order status
  const updateOrderStatus = async (orderId: string, status: string) => {
    return updateSaleMutation.mutateAsync({ id: orderId, updates: { status } });
  };

  // Delete sale mutation (admin only)
  const deleteSaleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pos_sales').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_sales'] });
      queryClient.invalidateQueries({ queryKey: ['pos_analytics'] });
      toast({
        title: 'Sale Deleted',
        description: 'Sale record has been deleted',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    sales,
    isLoadingSales,
    salesError,
    getSale,
    createSale: createSaleMutation.mutateAsync,
    updateSale: updateSaleMutation.mutate,
    updateOrderStatus,
    deleteSale: deleteSaleMutation.mutate,
    isCreating: createSaleMutation.isPending,
    isUpdating: updateSaleMutation.isPending,
    isDeleting: deleteSaleMutation.isPending,
  };
};

/**
 * Hook to fetch discount rules
 */
export const useDiscountRules = () => {
  const queryClient = useQueryClient();

  const {
    data: discountRules = [],
    isLoading: isLoadingDiscounts,
    error: discountsError,
  } = useQuery({
    queryKey: ['discount_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discount_rules')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Create discount rule mutation
  const createDiscountMutation = useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await supabase
        .from('discount_rules')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount_rules'] });
      toast({
        title: 'Success',
        description: 'Discount rule created successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update discount rule mutation
  const updateDiscountMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('discount_rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount_rules'] });
      toast({
        title: 'Success',
        description: 'Discount rule updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete discount rule mutation
  const deleteDiscountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discount_rules').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount_rules'] });
      toast({
        title: 'Success',
        description: 'Discount rule deleted successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    discountRules,
    isLoadingDiscounts,
    discountsError,
    createDiscount: createDiscountMutation.mutate,
    updateDiscount: updateDiscountMutation.mutate,
    deleteDiscount: deleteDiscountMutation.mutate,
    isCreating: createDiscountMutation.isPending,
    isUpdating: updateDiscountMutation.isPending,
    isDeleting: deleteDiscountMutation.isPending,
  };
};

