import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  POSCategory,
  POSCategoryWithSubcategories,
  POSItem,
  POSItemWithDetails,
  CreatePOSCategoryInput,
  CreatePOSItemInput,
  POSItemFilters,
} from '@/types/pos';
import { toast } from '@/hooks/use-toast';

/**
 * Hook to fetch and manage POS categories
 */
export const usePOSCategories = () => {
  const queryClient = useQueryClient();

  // Fetch all categories
  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery<POSCategory[]>({
    queryKey: ['pos_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_categories')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Get parent categories (top-level)
  const parentCategories: POSCategoryWithSubcategories[] = categories
    .filter((cat) => !cat.parent_category_id)
    .map((parent) => ({
      ...parent,
      subcategories: categories.filter((cat) => cat.parent_category_id === parent.id),
    }));

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (input: CreatePOSCategoryInput) => {
      const { data, error } = await supabase
        .from('pos_categories')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_categories'] });
      toast({
        title: 'Success',
        description: 'Category created successfully',
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

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePOSCategoryInput> }) => {
      const { data, error } = await supabase
        .from('pos_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_categories'] });
      toast({
        title: 'Success',
        description: 'Category updated successfully',
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

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pos_categories').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_categories'] });
      toast({
        title: 'Success',
        description: 'Category deleted successfully',
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
    categories,
    parentCategories,
    isLoadingCategories,
    categoriesError,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    deleteCategory: deleteCategoryMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending,
    isDeleting: deleteCategoryMutation.isPending,
  };
};

/**
 * Hook to fetch and manage POS items
 */
export const usePOSItems = (filters?: POSItemFilters) => {
  const queryClient = useQueryClient();

  // Fetch items with optional filters
  const {
    data: items = [],
    isLoading: isLoadingItems,
    error: itemsError,
  } = useQuery<POSItemWithDetails[]>({
    queryKey: ['pos_items', filters],
    queryFn: async () => {
      let query = supabase
        .from('pos_items')
        .select(`
          *,
          category:pos_categories!pos_items_category_id_fkey(id, name),
          subcategory:pos_categories!pos_items_subcategory_id_fkey(id, name),
          recipe:recipes(id, name)
        `);

      // Apply filters
      if (filters?.category_id) {
        query = query.eq('category_id', filters.category_id);
      }

      if (filters?.subcategory_id) {
        query = query.eq('subcategory_id', filters.subcategory_id);
      }

      if (filters?.available !== undefined) {
        query = query.eq('available', filters.available);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      query = query.order('name', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async (input: CreatePOSItemInput) => {
      const { data, error } = await supabase
        .from('pos_items')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_items'] });
      toast({
        title: 'Success',
        description: 'Item created successfully',
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

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CreatePOSItemInput> }) => {
      const { data, error } = await supabase
        .from('pos_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_items'] });
      toast({
        title: 'Success',
        description: 'Item updated successfully',
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

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pos_items').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_items'] });
      toast({
        title: 'Success',
        description: 'Item deleted successfully',
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
    items,
    isLoadingItems,
    itemsError,
    createItem: createItemMutation.mutate,
    updateItem: updateItemMutation.mutate,
    deleteItem: deleteItemMutation.mutate,
    isCreating: createItemMutation.isPending,
    isUpdating: updateItemMutation.isPending,
    isDeleting: deleteItemMutation.isPending,
  };
};

