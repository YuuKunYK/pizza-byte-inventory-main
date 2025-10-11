import { useState, useCallback, useMemo } from 'react';
import {
  CartItem,
  Discount,
  POSState,
  OrderSummary,
} from '@/types/pos';
import {
  addToCart as addToCartUtil,
  updateCartItemQuantity as updateCartItemQuantityUtil,
  removeFromCart as removeFromCartUtil,
  clearCart as clearCartUtil,
  applyDiscount as applyDiscountUtil,
  removeDiscount as removeDiscountUtil,
  clearDiscounts as clearDiscountsUtil,
  calculateOrderSummary,
  validateCart,
} from '@/lib/pos-utils';

/**
 * Main POS state management hook
 * Manages cart, discounts, and order calculations
 */
export const usePOS = (initialOrderType: 'dining' | 'takeaway' | 'delivery' = 'dining') => {
  const [state, setState] = useState<POSState>({
    cart: [],
    selectedCategory: null,
    selectedSubcategory: null,
    discounts: [],
    orderType: initialOrderType,
    paymentMethod: 'cash',
    notes: '',
  });

  // Add item to cart
  const addToCart = useCallback((item: CartItem) => {
    setState((prev) => ({
      ...prev,
      cart: addToCartUtil(prev.cart, item),
    }));
  }, []);

  // Update item quantity
  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    setState((prev) => ({
      ...prev,
      cart: updateCartItemQuantityUtil(prev.cart, itemId, quantity),
    }));
  }, []);

  // Remove item from cart
  const removeItem = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      cart: removeFromCartUtil(prev.cart, itemId),
    }));
  }, []);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cart: clearCartUtil(),
    }));
  }, []);

  // Apply discount
  const applyDiscount = useCallback((discount: Discount) => {
    setState((prev) => ({
      ...prev,
      discounts: applyDiscountUtil(prev.discounts, discount),
    }));
  }, []);

  // Remove discount
  const removeDiscount = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      discounts: removeDiscountUtil(prev.discounts, index),
    }));
  }, []);

  // Clear all discounts
  const clearDiscounts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      discounts: clearDiscountsUtil(),
    }));
  }, []);

  // Set selected category
  const setSelectedCategory = useCallback((categoryId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedCategory: categoryId,
      selectedSubcategory: null, // Reset subcategory when category changes
    }));
  }, []);

  // Set selected subcategory
  const setSelectedSubcategory = useCallback((subcategoryId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedSubcategory: subcategoryId,
    }));
  }, []);

  // Set order type
  const setOrderType = useCallback((orderType: 'dining' | 'takeaway' | 'delivery') => {
    setState((prev) => ({
      ...prev,
      orderType,
    }));
  }, []);

  // Set payment method
  const setPaymentMethod = useCallback((paymentMethod: 'cash' | 'card' | 'wallet') => {
    setState((prev) => ({
      ...prev,
      paymentMethod,
    }));
  }, []);

  // Set notes
  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({
      ...prev,
      notes,
    }));
  }, []);

  // Reset entire POS state
  const resetPOS = useCallback(() => {
    setState({
      cart: [],
      selectedCategory: null,
      selectedSubcategory: null,
      discounts: [],
      orderType: initialOrderType,
      paymentMethod: 'cash',
      notes: '',
    });
  }, [initialOrderType]);

  // Calculate order summary (memoized)
  const orderSummary: OrderSummary = useMemo(
    () => calculateOrderSummary(state.cart, state.discounts),
    [state.cart, state.discounts]
  );

  // Validate cart
  const cartValidation = useMemo(() => validateCart(state.cart), [state.cart]);

  // Check if cart is empty
  const isCartEmpty = state.cart.length === 0;

  // Get item count in cart
  const itemCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  return {
    // State
    cart: state.cart,
    selectedCategory: state.selectedCategory,
    selectedSubcategory: state.selectedSubcategory,
    discounts: state.discounts,
    orderType: state.orderType,
    paymentMethod: state.paymentMethod,
    notes: state.notes,

    // Computed values
    orderSummary,
    cartValidation,
    isCartEmpty,
    itemCount,

    // Actions
    addToCart,
    updateItemQuantity,
    removeItem,
    clearCart,
    applyDiscount,
    removeDiscount,
    clearDiscounts,
    setSelectedCategory,
    setSelectedSubcategory,
    setOrderType,
    setPaymentMethod,
    setNotes,
    resetPOS,
  };
};

