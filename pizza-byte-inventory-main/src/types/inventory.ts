
// Update UnitType to use literal string type union instead of string type
export type UnitType = 'grams' | 'kg' | 'packet' | 'quantity' | 'liter' | 'ml';

export interface Category {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  categoryId: string;
  unitType: UnitType;
  conversionValue: number; // e.g., 1 packet = 2000g
  costPerUnit: number; // in PKR
  currentStock: number;
  locationId: string;
  minStockThreshold: number;
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

export interface Recipe {
  id: string;
  name: string;
  description: string;
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

export interface Sale {
  id: string;
  recipeId: string;
  quantity: number;
  locationId: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}
