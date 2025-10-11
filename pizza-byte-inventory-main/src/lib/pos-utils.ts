// POS Utility Functions

import {
  CartItem,
  Discount,
  OrderSummary,
  TAX_RATE,
  pkrToPaisa,
  paisaToPkr,
} from '@/types/pos';

/**
 * Generate a unique order number
 * Format: ORD-YYYYMMDD-NNNN
 */
export const generateOrderNumber = (): string => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `ORD-${dateStr}-${randomNum}`;
};

/**
 * Calculate subtotal from cart items
 */
export const calculateSubtotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.total, 0);
};

/**
 * Calculate discount amount based on type and value
 */
export const calculateDiscountAmount = (
  subtotal: number,
  discountType: 'percentage' | 'fixed' | 'none',
  discountValue: number
): number => {
  if (discountType === 'none' || discountValue === 0) {
    return 0;
  }

  if (discountType === 'percentage') {
    return Math.round((subtotal * discountValue) / 100);
  }

  // Fixed discount
  return Math.min(pkrToPaisa(discountValue), subtotal);
};

/**
 * Calculate tax amount
 */
export const calculateTax = (amount: number, taxRate: number = TAX_RATE): number => {
  return Math.round(amount * taxRate);
};

/**
 * Calculate total profit from cart items
 */
export const calculateProfit = (items: CartItem[], discountAmount: number = 0): number => {
  const totalCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
  const totalRevenue = calculateSubtotal(items) - discountAmount;
  return totalRevenue - totalCost;
};

/**
 * Calculate complete order summary
 */
export const calculateOrderSummary = (
  items: CartItem[],
  discounts: Discount[] = []
): OrderSummary => {
  const subtotal = calculateSubtotal(items);

  // Apply discounts sequentially
  let totalDiscount = 0;
  let currentAmount = subtotal;

  for (const discount of discounts) {
    const discountAmount = calculateDiscountAmount(
      currentAmount,
      discount.type,
      discount.value
    );
    totalDiscount += discountAmount;
    currentAmount -= discountAmount;
  }

  const afterDiscount = subtotal - totalDiscount;
  const tax = calculateTax(afterDiscount);
  const total = afterDiscount + tax;
  const profit = calculateProfit(items, totalDiscount);

  return {
    items,
    subtotal,
    discounts,
    totalDiscount,
    tax,
    total,
    profit,
  };
};

/**
 * Add item to cart or increase quantity if exists
 */
export const addToCart = (cart: CartItem[], newItem: CartItem): CartItem[] => {
  const existingIndex = cart.findIndex((item) => item.item_id === newItem.item_id);

  if (existingIndex >= 0) {
    const updated = [...cart];
    updated[existingIndex] = {
      ...updated[existingIndex],
      quantity: updated[existingIndex].quantity + newItem.quantity,
      total: (updated[existingIndex].quantity + newItem.quantity) * updated[existingIndex].price,
    };
    return updated;
  }

  return [...cart, newItem];
};

/**
 * Update item quantity in cart
 */
export const updateCartItemQuantity = (
  cart: CartItem[],
  itemId: string,
  quantity: number
): CartItem[] => {
  if (quantity <= 0) {
    return cart.filter((item) => item.item_id !== itemId);
  }

  return cart.map((item) =>
    item.item_id === itemId
      ? { ...item, quantity, total: quantity * item.price }
      : item
  );
};

/**
 * Remove item from cart
 */
export const removeFromCart = (cart: CartItem[], itemId: string): CartItem[] => {
  return cart.filter((item) => item.item_id !== itemId);
};

/**
 * Clear entire cart
 */
export const clearCart = (): CartItem[] => {
  return [];
};

/**
 * Apply a discount to the discount list
 */
export const applyDiscount = (
  discounts: Discount[],
  newDiscount: Discount
): Discount[] => {
  // For now, we allow stacking. You can modify this logic as needed
  return [...discounts, newDiscount];
};

/**
 * Remove a discount from the list
 */
export const removeDiscount = (discounts: Discount[], index: number): Discount[] => {
  return discounts.filter((_, i) => i !== index);
};

/**
 * Clear all discounts
 */
export const clearDiscounts = (): Discount[] => {
  return [];
};

/**
 * Validate cart before checkout
 */
export const validateCart = (cart: CartItem[]): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (cart.length === 0) {
    errors.push('Cart is empty');
  }

  cart.forEach((item, index) => {
    if (item.quantity <= 0) {
      errors.push(`Item ${index + 1} has invalid quantity`);
    }
    if (item.price < 0) {
      errors.push(`Item ${index + 1} has invalid price`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Format time for display
 */
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format date for display
 */
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format date and time for display
 */
export const formatDateTime = (date: Date | string): string => {
  return `${formatDate(date)} ${formatTime(date)}`;
};

/**
 * Get today's date range for filtering
 */
export const getTodayRange = (): { start: string; end: string } => {
  const today = new Date();
  const start = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const end = new Date(today.setHours(23, 59, 59, 999)).toISOString();
  return { start, end };
};

/**
 * Get date range for last N days
 */
export const getLastNDaysRange = (days: number): { start: string; end: string } => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
};

/**
 * Calculate margin percentage
 */
export const calculateMarginPercentage = (price: number, cost: number): number => {
  if (price === 0) return 0;
  return ((price - cost) / price) * 100;
};

/**
 * Search items by name or description
 */
export const searchItems = <T extends { name: string; description?: string }>(
  items: T[],
  query: string
): T[] => {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description?.toLowerCase().includes(lowerQuery)
  );
};

/**
 * Group items by category
 */
export const groupItemsByCategory = <T extends { category_id: string | null }>(
  items: T[]
): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();

  items.forEach((item) => {
    const categoryId = item.category_id || 'uncategorized';
    if (!grouped.has(categoryId)) {
      grouped.set(categoryId, []);
    }
    grouped.get(categoryId)!.push(item);
  });

  return grouped;
};

/**
 * Sort categories by display order
 */
export const sortCategoriesByOrder = <T extends { display_order: number; name: string }>(
  categories: T[]
): T[] => {
  return [...categories].sort((a, b) => {
    if (a.display_order !== b.display_order) {
      return a.display_order - b.display_order;
    }
    return a.name.localeCompare(b.name);
  });
};

