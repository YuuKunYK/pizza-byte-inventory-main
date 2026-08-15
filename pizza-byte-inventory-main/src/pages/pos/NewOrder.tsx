import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, X } from 'lucide-react';
import { CategoryGrid } from '@/components/pos/CategoryGrid';
import { ItemGrid } from '@/components/pos/ItemGrid';
import { OrderSummary } from '@/components/pos/OrderSummary';
import { Calculator } from '@/components/pos/Calculator';
import { DiscountPanel } from '@/components/pos/DiscountPanel';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { ReceiptPrint, printReceipt } from '@/components/pos/ReceiptPrint';
import { usePOS } from '@/hooks/usePOS';
import { usePOSCategories, usePOSItems } from '@/hooks/usePOSCategories';
import { usePOSSales } from '@/hooks/usePOSSales';
import { useAuth } from '@/hooks/useAuth';
import { POSItemWithDetails, CartItem, POSSale } from '@/types/pos';
import { toast } from '@/hooks/use-toast';
import { checkPosStockAvailability, formatShortageMessage, summarizeDiscounts } from '@/lib/erp';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const getOrderTypeFromUrl = (): 'dining' | 'takeaway' | 'delivery' => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') as 'dining' | 'takeaway' | 'delivery';
  return type === 'takeaway' || type === 'delivery' || type === 'dining' ? type : 'dining';
};

const NewOrder: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useBusinessSettings();
  const orderType = getOrderTypeFromUrl();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [completedSale, setCompletedSale] = useState<POSSale | null>(null);
  const [isCheckingStock, setIsCheckingStock] = useState(false);

  const {
    cart,
    selectedCategory,
    selectedSubcategory,
    discounts,
    orderSummary,
    paymentMethod,
    notes,
    isCartEmpty,
    cartValidation,
    addToCart,
    updateItemQuantity,
    removeItem,
    clearCart,
    applyDiscount,
    removeDiscount,
    clearDiscounts,
    setSelectedCategory,
    setSelectedSubcategory,
    setPaymentMethod,
    setNotes,
    resetPOS,
  } = usePOS(orderType, settings.taxRate);

  const { parentCategories } = usePOSCategories();
  const { items, isLoadingItems } = usePOSItems({
    category_id: selectedCategory || undefined,
    subcategory_id: selectedSubcategory || undefined,
    search: searchQuery || undefined,
    available: true,
  });

  const { createSale, isCreating } = usePOSSales();

  const handleItemClick = (item: POSItemWithDetails) => {
    const cartItem: CartItem = {
      item_id: item.id,
      name: item.name,
      quantity: 1,
      price: item.price,
      cost: item.cost_per_item,
      total: item.price,
      image_url: item.image_url,
      recipe_id: item.recipe_id,
    };

    addToCart(cartItem);
  };

  const handleCheckout = async (amountTendered?: number) => {
    if (!cartValidation.valid) {
      toast({
        title: 'Invalid Cart',
        description: cartValidation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }

    if (!user?.locationId) {
      toast({
        title: 'Error',
        description: 'Your account is not assigned to a branch. Ask an admin to set your location.',
        variant: 'destructive',
      });
      return;
    }

    if (orderType === 'dining' && !tableNumber.trim()) {
      toast({
        title: 'Table required',
        description: 'Enter a table number for dine-in orders.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCheckingStock(true);
      const availability = await checkPosStockAvailability(cart, user.locationId);
      if (!availability.ok) {
        toast({
          title: 'Not enough ingredients',
          description: formatShortageMessage(availability.shortages),
          variant: 'destructive',
        });
        return;
      }

      const discountMeta = summarizeDiscounts(discounts);
      const sale = await createSale({
        items: cart,
        subtotal: orderSummary.subtotal,
        discount_type: discountMeta.discount_type,
        discount_value: discountMeta.discount_value,
        discount_amount: orderSummary.totalDiscount,
        tax: orderSummary.tax,
        total_amount: orderSummary.total,
        profit: orderSummary.profit,
        payment_method: paymentMethod,
        order_type: orderType,
        status: 'pending',
        table_number: tableNumber || undefined,
        customer_name: customerName || undefined,
        branch_id: user.locationId,
        cashier_id: user.id,
        notes: notes || undefined,
        discounts,
        amount_tendered: amountTendered,
      });

      setIsCheckoutOpen(false);
      resetPOS();
      setTableNumber('');
      setCustomerName('');
      setCompletedSale(sale);
    } catch (error: any) {
      toast({
        title: 'Checkout Failed',
        description: error.message || 'Failed to process the order',
        variant: 'destructive',
      });
    } finally {
      setIsCheckingStock(false);
    }
  };

  const title = useMemo(
    () => `New ${orderType.charAt(0).toUpperCase() + orderType.slice(1)} Order`,
    [orderType]
  );

  if (completedSale) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Card className="max-w-lg mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-bold">Order {completedSale.order_number}</h1>
          <p className="text-muted-foreground">
            Sent to the kitchen. Ingredients for linked recipes were deducted from this branch.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => printReceipt()}>Print receipt</Button>
            <Button variant="outline" onClick={() => window.close()}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCompletedSale(null);
              }}
            >
              New order
            </Button>
          </div>
        </Card>
        <ReceiptPrint
          sale={completedSale}
          branchName={user?.locationName || settings.restaurantName}
          cashierName={user?.name}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Select dishes. Linked recipes will consume ingredient stock at checkout.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => window.close()}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          {orderType === 'dining' && (
            <div>
              <Label htmlFor="table">Table Number</Label>
              <Input
                id="table"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g., T-12"
              />
            </div>
          )}
          <div>
            <Label htmlFor="customer">
              {orderType === 'delivery' ? 'Customer Name' : 'Customer Name (Optional)'}
            </Label>
            <Input
              id="customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <CategoryGrid
            categories={parentCategories}
            selectedCategory={selectedCategory}
            selectedSubcategory={selectedSubcategory}
            onSelectCategory={setSelectedCategory}
            onSelectSubcategory={setSelectedSubcategory}
          />
          <ItemGrid items={items} onItemClick={handleItemClick} isLoading={isLoadingItems} />
        </div>

        <div className="space-y-4">
          <OrderSummary
            orderSummary={orderSummary}
            onUpdateQuantity={updateItemQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
          />
          <Button
            onClick={() => setIsCheckoutOpen(true)}
            disabled={isCartEmpty || !cartValidation.valid}
            size="lg"
            className="w-full"
          >
            Place Order
          </Button>
          <Calculator />
          <DiscountPanel
            discounts={discounts}
            onApplyDiscount={applyDiscount}
            onRemoveDiscount={removeDiscount}
            onClearDiscounts={clearDiscounts}
          />
        </div>
      </div>

      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        orderSummary={orderSummary}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        notes={notes}
        onNotesChange={setNotes}
        onConfirmCheckout={handleCheckout}
        isProcessing={isCreating || isCheckingStock}
      />
    </div>
  );
};

export default NewOrder;
