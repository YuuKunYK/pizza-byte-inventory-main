import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export interface PizzaDoughConfig {
  id: string;
  size_id: string;
  size_name: string;
  standard_dough: number;
  thin_crust_dough: number;
  created_at?: string;
  updated_at?: string;
}

export interface CalzoneDoughConfig {
  id: string;
  size_id: string;
  size_name: string;
  dough_amount: number;
  created_at?: string;
  updated_at?: string;
}

export const useDoughConfig = () => {
  const queryClient = useQueryClient();

  // Fetch pizza dough configuration
  const {
    data: pizzaDoughConfig = [],
    isLoading: isLoadingPizza,
    error: pizzaError
  } = useQuery({
    queryKey: ['pizza_dough_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pizza_dough_config')
        .select('*')
        .order('size_id');
      
      if (error) throw error;
      return data as PizzaDoughConfig[];
    }
  });

  // Fetch calzone dough configuration
  const {
    data: calzoneDoughConfig = [],
    isLoading: isLoadingCalzone,
    error: calzoneError
  } = useQuery({
    queryKey: ['calzone_dough_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calzone_dough_config')
        .select('*')
        .order('size_id');
      
      if (error) throw error;
      return data as CalzoneDoughConfig[];
    }
  });

  // Update pizza dough configuration
  const updatePizzaDoughMutation = useMutation({
    mutationFn: async (configs: PizzaDoughConfig[]) => {
      const promises = configs.map(config => 
        supabase
          .from('pizza_dough_config')
          .update({
            standard_dough: config.standard_dough,
            thin_crust_dough: config.thin_crust_dough,
            updated_at: new Date().toISOString()
          })
          .eq('size_id', config.size_id)
      );
      
      const results = await Promise.all(promises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update some configurations: ${errors.map(e => e.error?.message).join(', ')}`);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pizza_dough_config'] });
      toast.success('Pizza dough configuration updated successfully');
    },
    onError: (error) => {
      console.error('Error updating pizza dough config:', error);
      toast.error('Failed to update pizza dough configuration', {
        description: error.message
      });
    }
  });

  // Update calzone dough configuration
  const updateCalzoneDoughMutation = useMutation({
    mutationFn: async (configs: CalzoneDoughConfig[]) => {
      const promises = configs.map(config => 
        supabase
          .from('calzone_dough_config')
          .update({
            dough_amount: config.dough_amount,
            updated_at: new Date().toISOString()
          })
          .eq('size_id', config.size_id)
      );
      
      const results = await Promise.all(promises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update some configurations: ${errors.map(e => e.error?.message).join(', ')}`);
      }
      
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calzone_dough_config'] });
      toast.success('Calzone dough configuration updated successfully');
    },
    onError: (error) => {
      console.error('Error updating calzone dough config:', error);
      toast.error('Failed to update calzone dough configuration', {
        description: error.message
      });
    }
  });

  return {
    // Data
    pizzaDoughConfig,
    calzoneDoughConfig,
    
    // Loading states
    isLoadingPizza,
    isLoadingCalzone,
    isLoading: isLoadingPizza || isLoadingCalzone,
    
    // Error states
    pizzaError,
    calzoneError,
    hasError: !!pizzaError || !!calzoneError,
    
    // Mutations
    updatePizzaDoughConfig: (configs: PizzaDoughConfig[]) => updatePizzaDoughMutation.mutate(configs),
    updateCalzoneDoughConfig: (configs: CalzoneDoughConfig[]) => updateCalzoneDoughMutation.mutate(configs),
    
    // Mutation states
    isUpdatingPizza: updatePizzaDoughMutation.isPending,
    isUpdatingCalzone: updateCalzoneDoughMutation.isPending,
    isUpdating: updatePizzaDoughMutation.isPending || updateCalzoneDoughMutation.isPending
  };
}; 