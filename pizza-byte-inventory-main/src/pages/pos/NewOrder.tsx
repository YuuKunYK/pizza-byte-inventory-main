import React, { useState, useEffect } from 'react';
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
import { usePOS } from '@/hooks/usePOS';
import { usePOSCategories, usePOSItems } from '@/hooks/usePOSCategories';
import { usePOSSales } from '@/hooks/usePOSSales';
import { useAuth } from '@/hooks/useAuth';
import { POSItemWithDetails, CartItem } from '@/types/pos';
import { toast } from '@/hooks/use-toast';

// Get order type from URL params
const getOrderTypeFromUrl = (): 'dining' | 'takeaway' | 'delivery' => {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type') as 'dining' | 'takeaway' | 'delivery';
  return type || 'dining';
};

const NewOrder: React.FC = () => {
  const { user } = useAuth();
  const orderType = getOrderTypeFromUrl();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  // POS State
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
  } = usePOS(orderType);

  // Fetch categories and items
  const { parentCategories } = usePOSCategories();
  const { items, isLoadingItems } = usePOSItems({
    category_id: selectedCategory || undefined,
    subcategory_id: selectedSubcategory || undefined,
    search: searchQuery || undefined,
    available: true,
  });

  // Sales operations
  const { createSale, isCreating } = usePOSSales();

  // Handle item click
  const handleItemClick = (item: POSItemWithDetails) => {
    const cartItem: CartItem = {
      item_id: item.id,
      name: item.name,
      quantity: 1,
      price: item.price,
      cost: item.cost_per_item,
      total: item.price,
      image_url: item.image_url,
    };

    addToCart(cartItem);
    toast({
      title: 'Added to cart',
      description: `${item.name} added successfully`,
    });
  };

  // Handle checkout
  const handleCheckout = async () => {
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
        description: 'Branch location not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createSale({
        items: cart,
        subtotal: orderSummary.subtotal,
        discount_type: discounts.length > 0 ? discounts[0].type : 'none',
        discount_value: discounts.length > 0 ? discounts[0].value : 0,
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
      });

      setIsCheckoutOpen(false);
      resetPOS();
      setTableNumber('');
      setCustomerName('');
      
      toast({
        title: 'Order Created',
        description: 'Order has been placed successfully',
      });

      // Close window after 2 seconds
      setTimeout(() => {
        window.close();
      }, 2000);
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Failed',
        description: error.message || 'Failed to process the order',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New {orderType.charAt(0).toUpperCase() + orderType.slice(1)} Order</h1>
          <p className="text-sm text-muted-foreground">Select items to create a new order</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => window.close()}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Order Info */}
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
            <Label htmlFor="customer">Customer Name (Optional)</Label>
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
        {/* Left Section - Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Grid */}
          <CategoryGrid
            categories={parentCategories}
            selectedCategory={selectedCategory}
            selectedSubcategory={selectedSubcategory}
            onSelectCategory={setSelectedCategory}
            onSelectSubcategory={setSelectedSubcategory}
          />

          {/* Item Grid */}
          <ItemGrid
            items={items}
            onItemClick={handleItemClick}
            isLoading={isLoadingItems}
          />
        </div>

        {/* Right Section - Order Summary & Tools */}
        <div className="space-y-4">
          {/* Order Summary */}
          <OrderSummary
            orderSummary={orderSummary}
            onUpdateQuantity={updateItemQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
          />

          {/* Action Buttons */}
          <Button
            onClick={() => setIsCheckoutOpen(true)}
            disabled={isCartEmpty || !cartValidation.valid}
            size="lg"
            className="w-full"
          >
            Place Order
          </Button>

          {/* Calculator */}
          <Calculator />

          {/* Discount Panel */}
          <DiscountPanel
            discounts={discounts}
            onApplyDiscount={applyDiscount}
            onRemoveDiscount={removeDiscount}
            onClearDiscounts={clearDiscounts}
          />
        </div>
      </div>

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        orderSummary={orderSummary}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        notes={notes}
        onNotesChange={setNotes}
        onConfirmCheckout={handleCheckout}
        isProcessing={isCreating}
      />
    </div>
  );
};

export default NewOrder;

