import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BusinessSettings {
  restaurantName: string;
  taxRate: number;
  timezone: string;
  currency: string;
}

const SETTINGS_KEY = 'erp_business_settings';

const defaults: BusinessSettings = {
  restaurantName: 'New York Pizza',
  taxRate: 0,
  timezone: 'Asia/Karachi',
  currency: 'PKR',
};

const readLocal = (): BusinessSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
};

export const useBusinessSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings = readLocal() } = useQuery({
    queryKey: ['business_settings'],
    queryFn: async (): Promise<BusinessSettings> => {
      const local = readLocal();
      const { data, error } = await supabase
        .from('organization_settings')
        .select('key, value')
        .in('key', ['restaurant_name', 'tax_rate', 'timezone', 'currency']);

      if (error || !data?.length) return local;

      const map = Object.fromEntries(data.map((row) => [row.key, row.value]));
      return {
        restaurantName: (map.restaurant_name as string) || local.restaurantName,
        taxRate: Number(map.tax_rate ?? local.taxRate) || 0,
        timezone: (map.timezone as string) || local.timezone,
        currency: (map.currency as string) || local.currency,
      };
    },
    initialData: readLocal(),
  });

  const saveMutation = useMutation({
    mutationFn: async (next: BusinessSettings) => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      const rows = [
        { key: 'restaurant_name', value: next.restaurantName },
        { key: 'tax_rate', value: next.taxRate },
        { key: 'timezone', value: next.timezone },
        { key: 'currency', value: next.currency },
      ];
      const { error } = await supabase.from('organization_settings').upsert(
        rows.map((row) => ({ ...row, organization_id: null })),
        { onConflict: 'key' }
      );
      if (error) {
        // Local save already happened; remote catalog may not exist yet.
        console.warn('Could not persist settings remotely', error.message);
      }
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['business_settings'], next);
    },
  });

  return {
    settings,
    saveSettings: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
};
