import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { POSSaleWithDetails } from '@/types/pos';
import { formatCurrency } from '@/types/pos';
import { formatDateTime } from '@/lib/pos-utils';
import { Receipt, Clock } from 'lucide-react';

interface OrderHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sales: POSSaleWithDetails[];
  isLoading?: boolean;
}

export const OrderHistoryDialog: React.FC<OrderHistoryDialogProps> = ({
  open,
  onOpenChange,
  sales,
  isLoading,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Order History
          </DialogTitle>
          <DialogDescription>Recent orders and transactions</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-muted rounded-lg" />
                </div>
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No orders found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sales.map((sale) => (
                <div key={sale.id} className="border rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{sale.order_number}</span>
                        <Badge variant="outline">{sale.order_type}</Badge>
                        <Badge
                          variant={
                            sale.payment_method === 'cash'
                              ? 'default'
                              : sale.payment_method === 'card'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {sale.payment_method}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(sale.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">
                        {formatCurrency(sale.total_amount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Profit: {formatCurrency(sale.profit)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Items */}
                  <div className="space-y-1">
                    {(sale.items as any[]).map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-medium">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="space-y-1 pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(sale.subtotal)}</span>
                    </div>
                    {sale.discount_amount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(sale.discount_amount)}</span>
                      </div>
                    )}
                    {sale.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span>{formatCurrency(sale.tax)}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {sale.notes && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground italic">Note: {sale.notes}</p>
                    </div>
                  )}

                  {/* Branch & Cashier */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                    {sale.branch && <span>Branch: {sale.branch.name}</span>}
                    {sale.cashier && <span>Cashier: {sale.cashier.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

