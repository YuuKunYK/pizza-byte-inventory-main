import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  related_to: string;
  related_id: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotification: (id: string) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
};

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user, isAuthenticated } = useAuth();

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Load notifications on auth change
  useEffect(() => {
    if (isAuthenticated && user) {
      refreshNotifications();
      
      // Set up real-time subscriptions
      const cleanup = setupSubscriptions();
      return cleanup;
    }
  }, [isAuthenticated, user]);

  // Subscribe to real-time notifications
  const setupSubscriptions = () => {
    // Listen for stock requests changes
    const stockRequestsSubscription = supabase
      .channel('stock_requests_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'stock_requests',
      }, handleStockRequestChange)
      .subscribe();

    // Listen for new notifications
    const notificationsSubscription = supabase
      .channel('notifications_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          // Show toast for new notification
          const notification = payload.new as Notification;
          toast(notification.title, {
            description: notification.message,
          });
          refreshNotifications();
        } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          refreshNotifications();
        }
      })
      .subscribe();

    return () => {
      stockRequestsSubscription.unsubscribe();
      notificationsSubscription.unsubscribe();
    };
  };

  // Handle stock request changes
  const handleStockRequestChange = async (payload) => {
    // Only process relevant events
    if (!payload.new || !payload.old) return;

    const stockRequest = payload.new;
    const oldStatus = payload.old.status;
    const newStatus = stockRequest.status;

    // Status has changed - create notification based on role
    if (oldStatus !== newStatus) {
      if (stockRequest.to_location_id === user?.locationId) {
        // For requesting location
        let message = '';
        let type: 'info' | 'success' | 'warning' | 'error' = 'info';

        switch (newStatus) {
          case 'fulfilled':
            message = 'Your stock request has been fulfilled and is on its way.';
            type = 'success';
            break;
          case 'partial':
            message = 'Your stock request has been partially fulfilled.';
            type = 'warning';
            break;
          case 'rejected':
            message = 'Your stock request has been rejected.';
            type = 'error';
            break;
          default:
            return; // Don't create notification for other status changes
        }

        // Get more details for better notifications
        const { data } = await supabase
          .from('stock_requests')
          .select(`
            *,
            item:inventory_items(id, name),
            from_location:locations!stock_requests_from_location_id_fkey(id, name)
          `)
          .eq('id', stockRequest.id)
          .single();

        if (data) {
          try {
            // Store notification in activity logs instead since we haven't created the notifications table yet
            await supabase.from('activity_logs').insert({
              action: `Stock Request ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
              entity_type: 'stock_request',
              entity_id: stockRequest.id,
              user_id: user?.id,
              location_id: user?.locationId,
              details: JSON.stringify({
                title: `Stock Request ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
                message: `${data.item?.name || 'Item'} request from ${data.from_location?.name || 'sender'} has been ${newStatus}`,
                type,
                is_read: false
              })
            });
            
            // Mock notification for now
            const mockNotification: Notification = {
              id: Math.random().toString(36).substring(2, 11),
              user_id: user?.id,
              title: `Stock Request ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
              message: `${data.item?.name || 'Item'} request from ${data.from_location?.name || 'sender'} has been ${newStatus}`,
              type,
              related_to: 'stock_request',
              related_id: stockRequest.id,
              is_read: false,
              created_at: new Date().toISOString()
            };
            
            setNotifications(prev => [mockNotification, ...prev]);
            
            // Show toast notification
            toast(mockNotification.title, {
              description: mockNotification.message,
            });
          } catch (error) {
            console.error('Error creating notification:', error);
          }
        }
      }
    }
  };

  // Fetch notifications from the database
  const refreshNotifications = async () => {
    if (!user) return;

    try {
      // In a production app, you would fetch from the notifications table
      // But for this demo we'll use activity logs with a filter
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
      
      // Convert activity logs to notifications format
      const convertedNotifications: Notification[] = (data || []).map(log => {
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
    } catch (error) {
      console.error('Error parsing notifications:', error);
    }
  };

  // Mark a notification as read
  const markAsRead = async (id: string) => {
    if (!user) return;

    try {
      // Find notification in state
      const notification = notifications.find(n => n.id === id);
      if (!notification) return;
      
      // Update activity log
      const { error } = await supabase
        .from('activity_logs')
        .update({ 
          details: JSON.stringify({
            ...JSON.parse(notification.message),
            is_read: true
          })
        })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }
      
      // Update state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;

    // Just update state for now
    setNotifications(prev => 
      prev.map(n => ({ ...n, is_read: true }))
    );
  };

  // Delete a notification
  const clearNotification = async (id: string) => {
    if (!user) return;

    // Update state by removing the notification
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}; 