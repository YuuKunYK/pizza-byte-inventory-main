import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { POSSale, POSSaleWithDetails, CreateSaleInput, SalesFilters } from '@/types/pos';
import { toast } from '@/hooks/use-toast';
import { createPosOrder, updatePosOrderStatus as updatePosOrderStatusRpc } from '@/lib/erp';

const salesSelect = `
  *,
  branch:locations(id, name)
`;

export const usePOSSales = (filters?: SalesFilters) => {
  const queryClient = useQueryClient();

  const {
    data: sales = [],
    isLoading: isLoadingSales,
    error: salesError,
    refetch,
  } = useQuery<POSSaleWithDetails[]>({
    queryKey: ['pos_sales', filters],
    queryFn: async () => {
      let query = supabase
        .from('pos_sales')
        .select(salesSelect)
        .order('created_at', { ascending: false });

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

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as POSSaleWithDetails[];
    },
  });

  const getSale = async (id: string): Promise<POSSaleWithDetails | null> => {
    const { data, error } = await supabase
      .from('pos_sales')
      .select(salesSelect)
      .eq('id', id)
      .single();

    if (error) return null;
    return data as POSSaleWithDetails;
  };

  const createSaleMutation = useMutation({
    mutationFn: async (input: CreateSaleInput) => createPosOrder(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos_sales'] });
      queryClient.invalidateQueries({ queryKey: ['pos_analytics'] });
      queryClient.invalidateQueries({ queryKey: ['stock_entries'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      const unlinked = Array.isArray(data.unlinked_items) ? data.unlinked_items : [];
      toast({
        title: 'Order placed',
        description: unlinked.length
          ? `Order ${data.order_number} saved. Warning: no stock moved for ${unlinked.join(', ')}.`
          : data.inventory_deducted
            ? `Order ${data.order_number} saved and stock deducted from this branch.`
            : `Order ${data.order_number} saved.`,
        variant: unlinked.length ? 'destructive' : undefined,
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

  const updateSaleMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreateSaleInput> | { status: string } }) => {
      if ('status' in updates && updates.status && Object.keys(updates).length === 1) {
        return updatePosOrderStatusRpc(id, updates.status);
      }

      const { data, error } = await supabase
        .from('pos_sales')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as POSSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_sales'] });
      queryClient.invalidateQueries({ queryKey: ['pos_analytics'] });
      queryClient.invalidateQueries({ queryKey: ['stock_entries'] });
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

  const updateOrderStatus = async (orderId: string, status: string) => {
    return updateSaleMutation.mutateAsync({ id: orderId, updates: { status } });
  };

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
    refetch,
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

export const useDiscountRules = (includeInactive = false) => {
  const queryClient = useQueryClient();

  const {
    data: discountRules = [],
    isLoading: isLoadingDiscounts,
    error: discountsError,
  } = useQuery({
    queryKey: ['discount_rules', includeInactive],
    queryFn: async () => {
      let query = supabase.from('discount_rules').select('*').order('name', { ascending: true });
      if (!includeInactive) {
        query = query.eq('active', true);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const createDiscountMutation = useMutation({
    mutationFn: async (input: any) => {
      const { data, error } = await supabase.from('discount_rules').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount_rules'] });
      toast({ title: 'Success', description: 'Discount rule created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

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
      toast({ title: 'Success', description: 'Discount rule updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteDiscountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discount_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount_rules'] });
      toast({ title: 'Success', description: 'Discount rule deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
