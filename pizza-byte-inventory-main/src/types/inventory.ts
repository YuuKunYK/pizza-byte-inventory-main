
// Update UnitType to use literal string type union instead of string type
export type UnitType = 'grams' | 'kg' | 'packet' | 'quantity' | 'liter' | 'ml';
export type BaseUnitType = 'grams' | 'kg' | 'ml' | 'liter' | 'pcs';

export interface Location {
  id: string;
  name: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  categoryId: string;
  unitType: UnitType;
  conversionValue: number; // Legacy field - will be deprecated
  costPerUnit: number; // in PKR
  currentStock: number;
  locationId: string;
  minStockThreshold: number;
  // New conversion fields
  baseUnit?: BaseUnitType | null;
  purchaseUnit?: string | null;
  purchaseConversionValue?: number | null;
  manualConversionNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockEntry {
  id: string;
  itemId: string;
  locationId: string;
  openingStock: number;
  warehouseReceiving: number;
  localPurchasing: number;
  transferIn: number;
  transferOut: number;
  discarded: number;
  closingStock: number;
  idealClosing: number;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  itemId: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus = 'pending' | 'partial' | 'fulfilled' | 'rejected';

export interface StockRequest {
  id: string;
  itemId: string;
  quantity: number;
  requestedQuantity: number;
  dispatchedQuantity: number;
  status: RequestStatus;
  notes: string;
  fromLocationId: string;
  toLocationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sale {
  id: string;
  recipeId: string;
  quantity: number;
  locationId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

// Helper type for inventory item creation/editing
export interface InventoryItemFormData {
  name: string;
  category_id: string;
  unit_type: UnitType;
  cost_per_unit: number;
  min_stock_threshold?: number;
  // New conversion fields
  base_unit?: BaseUnitType;
  purchase_unit?: string;
  purchase_conversion_value?: number;
  manual_conversion_note?: string;
}

// Helper function to get base unit display name
export const getBaseUnitDisplayName = (unit: BaseUnitType): string => {
  switch (unit) {
    case 'grams':
      return 'Grams (g)';
    case 'kg':
      return 'Kilograms (kg)';
    case 'ml':
      return 'Milliliters (ml)';
    case 'liter':
      return 'Liters (L)';
    case 'pcs':
      return 'Pieces (pcs)';
    default:
      return unit;
  }
};

// Helper function to validate conversion
export const validateConversion = (baseUnit: BaseUnitType, purchaseUnit: string, conversionValue: number): boolean => {
  if (!baseUnit || !purchaseUnit || !conversionValue || conversionValue <= 0) {
    return false;
  }
  
  // If purchase unit equals base unit, conversion should be 1
  if (purchaseUnit.toLowerCase() === baseUnit.toLowerCase()) {
    return conversionValue === 1;
  }
  
  return true;
};
