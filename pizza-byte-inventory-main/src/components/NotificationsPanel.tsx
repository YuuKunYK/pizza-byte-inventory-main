import React from 'react';
import { Bell, Check, Trash2, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Mock data for notifications until we implement the real notifications system
interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  related_to: string;
  related_id: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearNotification: (id: string) => void;
}

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearNotification,
}) => {
  const navigate = useNavigate();
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicked
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.related_to === 'stock_request') {
      navigate('/requests');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-medium">
            Notifications
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Your recent notifications</CardDescription>
        </div>
        {notifications.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2"
            onClick={onMarkAllAsRead}
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[340px] pr-4">
          {notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start space-x-4 rounded-lg p-2.5 transition-colors relative",
                    notification.is_read ? "bg-background" : "bg-muted/50",
                    "hover:bg-muted cursor-pointer"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        "text-sm font-medium",
                        !notification.is_read && "font-semibold"
                      )}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.message}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearNotification(notification.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be notified when you have stock requests updates or other important events
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NotificationsPanel; 