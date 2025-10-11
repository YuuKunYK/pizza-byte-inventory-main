import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { POSSaleWithDetails } from '@/types/pos';
import { formatCurrency } from '@/types/pos';
import { Clock, User, Hash, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: POSSaleWithDetails;
  onClick: () => void;
  isSelected?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500';
    case 'preparing':
      return 'bg-blue-500';
    case 'ready':
      return 'bg-green-500';
    case 'served':
      return 'bg-purple-500';
    case 'completed':
      return 'bg-gray-500';
    case 'cancelled':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
};

const getTimeSince = (dateString: string): string => {
  const now = new Date();
  const orderTime = new Date(dateString);
  const diffMs = now.getTime() - orderTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return orderTime.toLocaleDateString();
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick, isSelected }) => {
  const itemCount = (order.items as any[]).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-lg',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono font-bold text-lg">{order.order_number}</span>
          </div>
          <Badge className={cn('text-white', getStatusColor(order.status))}>
            {order.status.toUpperCase()}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{getTimeSince(order.order_time)}</span>
            <span className="text-xs">
              {new Date(order.order_time).toLocaleTimeString('en-PK', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {order.table_number && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="font-semibold">Table:</span>
              <span>{order.table_number}</span>
            </div>
          )}

          {order.customer_name && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{order.customer_name}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="font-bold text-primary text-lg">
              {formatCurrency(order.total_amount)}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

