import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CartItem, OrderSummary as OrderSummaryType } from '@/types/pos';
import { formatCurrency } from '@/types/pos';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';

interface OrderSummaryProps {
  orderSummary: OrderSummaryType;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({
  orderSummary,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}) => {
  const { items, subtotal, discounts, totalDiscount, tax, total } = orderSummary;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Order Summary</CardTitle>
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCart}
              className="h-8 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        {items.length > 0 && (
          <Badge variant="secondary" className="w-fit">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Your cart is empty
              <br />
              Select items to get started
            </p>
          </div>
        ) : (
          <>
            {/* Cart Items */}
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-3 py-2">
                {items.map((item) => (
                  <div key={item.item_id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.price)} each
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => onRemoveItem(item.item_id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onUpdateQuantity(item.item_id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onUpdateQuantity(item.item_id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-semibold">{formatCurrency(item.total)}</span>
                    </div>

                    <Separator />
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Totals Section */}
            <div className="border-t p-6 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>

                {discounts.length > 0 && (
                  <>
                    {discounts.map((discount, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-green-600">
                          Discount {discount.rule_name && `(${discount.rule_name})`}
                        </span>
                        <span className="text-green-600 font-medium">
                          -{formatCurrency(discount.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-green-600">Total Discount</span>
                      <span className="text-green-600">-{formatCurrency(totalDiscount)}</span>
                    </div>
                  </>
                )}

                {tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-medium">{formatCurrency(tax)}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

