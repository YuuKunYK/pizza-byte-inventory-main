// POS System TypeScript Interfaces

export interface POSCategory {
  id: string;
  name: string;
  parent_category_id: string | null;
  display_order: number;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface POSCategoryWithSubcategories extends POSCategory {
  subcategories?: POSCategory[];
}

export interface POSItem {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null;
  price: number; // in paisa (PKR cents)
  recipe_id: string | null;
  /** Direct 1:1 stock link used instead of a recipe (e.g. bottled drinks). */
  inventory_item_id: string | null;
  /** Base units of inventory_item_id consumed per unit sold. */
  inventory_qty: number;
  /** False for items that legitimately move no stock (service charge, delivery fee). */
  inventory_tracked: boolean;
  cost_per_item: number; // in paisa
  available: boolean;
  image_url?: string;
  description?: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type POSItemLinkMode = 'recipe' | 'stock_item' | 'untracked';

export const getPOSItemLinkMode = (
  item: Pick<POSItem, 'recipe_id' | 'inventory_item_id' | 'inventory_tracked'>
): POSItemLinkMode | 'unlinked' => {
  if (item.recipe_id) return 'recipe';
  if (item.inventory_item_id) return 'stock_item';
  if (item.inventory_tracked === false) return 'untracked';
  // inventory_tracked only exists after the Phase 0 migration. Until then,
  // an item without a recipe is the old optional-link behaviour, not an error.
  if (typeof item.inventory_tracked === 'boolean') return 'unlinked';
  return 'recipe';
};

export interface POSItemWithDetails extends POSItem {
  category?: POSCategory;
  subcategory?: POSCategory;
  recipe?: {
    id: string;
    name: string;
  };
  inventory_item?: {
    id: string;
    name: string;
    base_unit?: string | null;
    unit_type?: string | null;
  };
}

export interface DiscountRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  conditions?: Record<string, any>;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  item_id: string;
  name: string;
  quantity: number;
  price: number; // unit price in paisa
  cost: number; // unit cost in paisa
  total: number; // quantity * price
  image_url?: string;
  recipe_id?: string | null;
}

export interface Discount {
  type: 'percentage' | 'fixed' | 'none';
  value: number;
  amount: number; // calculated discount amount in paisa
  rule_id?: string; // if from predefined rule
  rule_name?: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';

export interface POSSale {
  id: string;
  order_number: string;
  items: CartItem[];
  subtotal: number; // in paisa
  discount_type: 'percentage' | 'fixed' | 'none';
  discount_value: number;
  discount_amount: number; // in paisa
  tax: number; // in paisa
  total_amount: number; // in paisa
  profit: number; // in paisa
  payment_method: 'cash' | 'card' | 'wallet';
  order_type: 'dining' | 'takeaway' | 'delivery';
  status: OrderStatus;
  table_number?: string;
  customer_name?: string;
  order_time: string;
  served_time?: string;
  branch_id: string | null;
  cashier_id: string | null;
  notes?: string;
  discounts?: Discount[];
  amount_tendered?: number;
  change_due?: number;
  inventory_deducted?: boolean;
  /** Tracked items that moved no stock (only populated when policy is allow_with_flag). */
  unlinked_items?: string[];
  created_at: string;
  updated_at: string;
}

export interface POSSaleWithDetails extends POSSale {
  branch?: {
    id: string;
    name: string;
  };
  cashier?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface OrderSummary {
  items: CartItem[];
  subtotal: number; // in paisa
  discounts: Discount[];
  totalDiscount: number; // in paisa
  tax: number; // in paisa
  total: number; // in paisa
  profit: number; // in paisa
}

export interface POSAnalytics {
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  averageOrderValue: number;
  topSellingItems: {
    item_id: string;
    item_name: string;
    quantity_sold: number;
    revenue: number;
  }[];
  lowMarginItems: {
    item_id: string;
    item_name: string;
    margin_percentage: number;
    total_sold: number;
  }[];
  salesByOrderType: {
    order_type: string;
    count: number;
    revenue: number;
  }[];
  salesByPaymentMethod: {
    payment_method: string;
    count: number;
    revenue: number;
  }[];
}

export interface POSState {
  cart: CartItem[];
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  discounts: Discount[];
  orderType: 'dining' | 'takeaway' | 'delivery';
  paymentMethod: 'cash' | 'card' | 'wallet';
  notes: string;
}

// Helper types for creating/updating records
export interface CreatePOSCategoryInput {
  name: string;
  parent_category_id?: string | null;
  display_order?: number;
  icon?: string;
}

export interface CreatePOSItemInput {
  name: string;
  category_id: string | null;
  subcategory_id?: string | null;
  price: number;
  recipe_id?: string | null;
  inventory_item_id?: string | null;
  inventory_qty?: number;
  inventory_tracked?: boolean;
  available?: boolean;
  image_url?: string;
  description?: string;
}

export interface CreateDiscountRuleInput {
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  conditions?: Record<string, any>;
  active?: boolean;
}

export interface CreateSaleInput {
  items: CartItem[];
  subtotal: number;
  discount_type: 'percentage' | 'fixed' | 'none';
  discount_value: number;
  discount_amount: number;
  tax: number;
  total_amount: number;
  profit: number;
  payment_method: 'cash' | 'card' | 'wallet';
  order_type: 'dining' | 'takeaway' | 'delivery';
  status?: OrderStatus;
  table_number?: string;
  customer_name?: string;
  branch_id: string;
  cashier_id: string;
  notes?: string;
  discounts?: Discount[];
  amount_tendered?: number;
}

// Filter and search types
export interface POSItemFilters {
  category_id?: string;
  subcategory_id?: string;
  available?: boolean;
  search?: string;
}

export interface SalesFilters {
  startDate?: string;
  endDate?: string;
  branch_id?: string;
  order_type?: 'dining' | 'takeaway' | 'delivery';
  payment_method?: 'cash' | 'card' | 'wallet';
  cashier_id?: string;
  status?: OrderStatus | 'all';
}

// Constants
export const TAX_RATE = 0.0; // 0% tax (adjust as needed)
export const CURRENCY_SYMBOL = 'PKR';
export const PAISA_TO_PKR = 100; // 100 paisa = 1 PKR

// Helper function to convert PKR to paisa
export const pkrToPaisa = (pkr: number): number => Math.round(pkr * PAISA_TO_PKR);

// Helper function to convert paisa to PKR
export const paisaToPkr = (paisa: number): number => paisa / PAISA_TO_PKR;

// Helper function to format currency
export const formatCurrency = (paisa: number): string => {
  const pkr = paisaToPkr(paisa);
  return `${CURRENCY_SYMBOL} ${pkr.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

