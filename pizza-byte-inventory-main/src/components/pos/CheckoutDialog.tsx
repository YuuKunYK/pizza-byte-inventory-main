import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { OrderSummary } from '@/types/pos';
import { formatCurrency } from '@/types/pos';
import { CreditCard, Wallet, Banknote, Loader2 } from 'lucide-react';

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderSummary: OrderSummary;
  paymentMethod: 'cash' | 'card' | 'wallet';
  onPaymentMethodChange: (method: 'cash' | 'card' | 'wallet') => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  onConfirmCheckout: () => Promise<void>;
  isProcessing?: boolean;
}

export const CheckoutDialog: React.FC<CheckoutDialogProps> = ({
  open,
  onOpenChange,
  orderSummary,
  paymentMethod,
  onPaymentMethodChange,
  notes,
  onNotesChange,
  onConfirmCheckout,
  isProcessing = false,
}) => {
  const { subtotal, totalDiscount, tax, total, items } = orderSummary;

  const handleConfirm = async () => {
    await onConfirmCheckout();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout</DialogTitle>
          <DialogDescription>Complete the sale and process payment</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Order Summary</Label>
            <div className="bg-muted rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Items ({items.length})</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={onPaymentMethodChange as any}>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <RadioGroupItem
                    value="cash"
                    id="cash"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="cash"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Banknote className="h-6 w-6 mb-2" />
                    <span className="text-xs font-medium">Cash</span>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem
                    value="card"
                    id="card"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="card"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <CreditCard className="h-6 w-6 mb-2" />
                    <span className="text-xs font-medium">Card</span>
                  </Label>
                </div>

                <div>
                  <RadioGroupItem
                    value="wallet"
                    id="wallet"
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor="wallet"
                    className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Wallet className="h-6 w-6 mb-2" />
                    <span className="text-xs font-medium">Wallet</span>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-semibold">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any notes for this order..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>Complete Sale - {formatCurrency(total)}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

