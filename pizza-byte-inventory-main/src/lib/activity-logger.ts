import { supabase } from '@/integrations/supabase/client';

/**
 * Canonical plus live-DB entity names. The Phase 0 migration renames
 * inventory_items → inventory_item, etc. Until that lands, both appear in logs.
 */
export type EntityType =
  | 'pos_sale'
  | 'pos_item'
  | 'pos_category'
  | 'discount_rule'
  | 'inventory_item'
  | 'inventory_items'
  | 'category'
  | 'stock_entry'
  | 'stock_entries'
  | 'stock_request'
  | 'stock_requests'
  | 'transfer'
  | 'recipe'
  | 'recipes'
  | 'recipe_item'
  | 'profile'
  | 'profiles'
  | 'location'
  | 'locations'
  | 'sales'
  | 'settings'
  | 'system';

export const ENTITY_TYPES: EntityType[] = [
  'inventory_items',
  'stock_requests',
  'stock_entries',
  'recipes',
  'profiles',
  'locations',
  'sales',
  'pos_sale',
  'pos_item',
  'pos_category',
  'discount_rule',
  'inventory_item',
  'category',
  'stock_entry',
  'stock_request',
  'transfer',
  'recipe',
  'recipe_item',
  'profile',
  'location',
  'settings',
  'system',
];

export const ENTITY_LABELS: Record<EntityType, string> = {
  pos_sale: 'Orders',
  sales: 'Orders',
  pos_item: 'Menu items',
  pos_category: 'Menu categories',
  discount_rule: 'Discounts',
  inventory_item: 'Inventory items',
  inventory_items: 'Inventory items',
  category: 'Inventory categories',
  stock_entry: 'Stock adjustments',
  stock_entries: 'Stock adjustments',
  stock_request: 'Stock requests',
  stock_requests: 'Stock requests',
  transfer: 'Transfers',
  recipe: 'Recipes',
  recipes: 'Recipes',
  recipe_item: 'Recipe ingredients',
  profile: 'Users',
  profiles: 'Users',
  location: 'Locations',
  locations: 'Locations',
  settings: 'Settings',
  system: 'System',
};

interface LogActivityParams {
  action: string;
  entityType: EntityType;
  entityId?: string | null;
  locationId?: string | null;
  details?: Record<string, unknown>;
  userId?: string | null;
}

/**
 * Records a UI-level event. Never throws: a failed log line must not break
 * the user's action. Tries the new RPC, then the live-DB RPC, then a table insert.
 */
export const logActivity = async (params: LogActivityParams): Promise<boolean> => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = params.userId || sessionData.session?.user?.id || null;

    const modern = await supabase.rpc('log_activity', {
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId ?? null,
      p_details: params.details ?? {},
      p_location_id: params.locationId ?? null,
    });
    if (!modern.error) return true;

    const legacy = await supabase.rpc('log_activity', {
      _user_id: userId,
      _action: params.action,
      _entity_type: params.entityType,
      _entity_id: params.entityId ?? null,
      _details: params.details ?? {},
      _location_id: params.locationId ?? null,
    });
    if (!legacy.error) return true;

    if (!userId) {
      console.warn('Activity log failed:', modern.error?.message || legacy.error?.message);
      return false;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      location_id: params.locationId ?? null,
      details: params.details ?? {},
    });

    if (error) {
      console.warn('Activity log failed:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Activity log failed:', error);
    return false;
  }
};
