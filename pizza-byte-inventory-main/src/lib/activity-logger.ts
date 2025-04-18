import { supabase } from '@/integrations/supabase/client';

// Types matching the database structure
export type EntityType = 
  | 'inventory_items' 
  | 'stock_requests' 
  | 'stock_entries' 
  | 'recipes' 
  | 'profiles' 
  | 'locations' 
  | 'sales';

export type ActionType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'fulfill' 
  | 'reject' 
  | 'dispatch';

interface LogActivityParams {
  userId: string;
  action: ActionType;
  entityType: EntityType;
  entityId: string;
  locationId?: string;
  details: {
    before?: any;
    after?: any;
    reason?: string;
    [key: string]: any;
  };
}

/**
 * Logs an activity to the activity_logs table
 * 
 * @param params - Activity parameters
 * @returns Promise resolving to success status
 */
export const logActivity = async (params: LogActivityParams): Promise<boolean> => {
  try {
    console.log('Logging activity:', params);
    
    // Try the Supabase function first (if available)
    try {
      const { data: functionData, error: functionError } = await supabase.rpc('log_activity', {
        _user_id: params.userId,
        _action: params.action,
        _entity_type: params.entityType,
        _entity_id: params.entityId,
        _details: params.details,
        _location_id: params.locationId || null
      });
      
      if (!functionError) {
        console.log('Activity logged via function');
        return true;
      }
      
      // If there's an error with the function, fall back to direct insert
      console.warn('Error using log_activity function:', functionError);
    } catch (functionCallError) {
      console.warn('Error calling log_activity function:', functionCallError);
    }
    
    // Fallback: Insert directly into the activity_logs table
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: params.userId,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        location_id: params.locationId,
        details: params.details,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error logging activity:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in logActivity:', error);
    return false;
  }
};

/**
 * Simplifies logging item updates by automatically calculating changes
 */
export const logItemUpdate = async (
  userId: string, 
  entityType: EntityType, 
  entityId: string, 
  beforeData: any, 
  afterData: any, 
  locationId?: string,
  reason?: string
): Promise<boolean> => {
  // For update logs, include both the before and after state
  return logActivity({
    userId,
    action: 'update',
    entityType,
    entityId,
    locationId,
    details: {
      before: beforeData,
      after: afterData,
      reason
    }
  });
};

/**
 * Simplifies logging item creation
 */
export const logItemCreation = async (
  userId: string, 
  entityType: EntityType, 
  entityId: string, 
  itemData: any, 
  locationId?: string
): Promise<boolean> => {
  return logActivity({
    userId,
    action: 'create',
    entityType,
    entityId,
    locationId,
    details: {
      after: itemData
    }
  });
};

/**
 * Simplifies logging item deletion
 */
export const logItemDeletion = async (
  userId: string, 
  entityType: EntityType, 
  entityId: string, 
  itemData: any, 
  locationId?: string,
  reason?: string
): Promise<boolean> => {
  return logActivity({
    userId,
    action: 'delete',
    entityType,
    entityId,
    locationId,
    details: {
      before: itemData,
      reason
    }
  });
}; 