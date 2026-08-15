import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { POSSaleWithDetails, OrderStatus, formatCurrency } from '@/types/pos';
import { formatDateTime } from '@/lib/pos-utils';
import { Clock, User, Hash, CreditCard, Package, CheckCircle, XCircle, Printer } from 'lucide-react';
import { ReceiptPrint, printReceipt } from '@/components/pos/ReceiptPrint';

interface OrderDetailPanelProps {
  order: POSSaleWithDetails | null;
  onUpdateStatus?: (orderId: string, status: OrderStatus) => void;
  isUpdating?: boolean;
}

export const OrderDetailPanel: React.FC<OrderDetailPanelProps> = ({
  order,
  onUpdateStatus,
  isUpdating,
}) => {
  if (!order) {
    return (
      <Card className="h-full flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3" />
            <p>Select an order to view details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = order.items as any[];
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Order Details</CardTitle>
          <Badge variant="outline" className="font-mono">
            {order.order_number}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 py-2">
            {/* Order Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Order Time:</span>
                <span className="font-medium">{formatDateTime(order.order_time)}</span>
              </div>

              {order.table_number && (
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Table:</span>
                  <span className="font-medium">{order.table_number}</span>
                </div>
              )}

              {order.customer_name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{order.customer_name}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Payment:</span>
                <span className="font-medium capitalize">{order.payment_method}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{order.order_type}</span>
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <h4 className="font-semibold mb-3">Items ({itemCount})</h4>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(order.subtotal)}</span>
              </div>

              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span className="font-medium">-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}

              {order.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatCurrency(order.tax)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(order.total_amount)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit</span>
                <span className="font-semibold text-green-600">{formatCurrency(order.profit)}</span>
              </div>
            </div>

            {order.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2 text-sm">Notes</h4>
                  <p className="text-sm text-muted-foreground italic">{order.notes}</p>
                </div>
              </>
            )}

            {order.served_time && (
              <>
                <Separator />
                <div className="text-sm">
                  <span className="text-muted-foreground">Served at:</span>
                  <span className="ml-2 font-medium">{formatDateTime(order.served_time)}</span>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        {/* Status Actions */}
        <div className="border-t p-4 space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => printReceipt()}
          >
            <Printer className="h-4 w-4 mr-1" />
            Print receipt
          </Button>
          <ReceiptPrint sale={order} branchName={order.branch?.name} />

          {onUpdateStatus && order.status !== 'completed' && order.status !== 'cancelled' && (
            <>
              <h4 className="font-semibold text-sm mb-2">Update Status</h4>
              <div className="grid grid-cols-2 gap-2">
                {order.status === 'pending' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onUpdateStatus(order.id, 'preparing')}
                      disabled={isUpdating}
                    >
                      Start Preparing
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateStatus(order.id, 'cancelled')}
                      disabled={isUpdating}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </>
                )}

                {order.status === 'preparing' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onUpdateStatus(order.id, 'ready')}
                      disabled={isUpdating}
                    >
                      Mark as Ready
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateStatus(order.id, 'cancelled')}
                      disabled={isUpdating}
                    >
                      Cancel & restore stock
                    </Button>
                  </>
                )}

                {order.status === 'ready' && (
                  <Button
                    size="sm"
                    onClick={() => onUpdateStatus(order.id, 'served')}
                    disabled={isUpdating}
                    className="col-span-2"
                  >
                    Mark as Served
                  </Button>
                )}

                {order.status === 'served' && (
                  <Button
                    size="sm"
                    onClick={() => onUpdateStatus(order.id, 'completed')}
                    disabled={isUpdating}
                    className="col-span-2"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete Order
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

