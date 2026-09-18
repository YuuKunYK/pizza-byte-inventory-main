import { supabase } from '@/integrations/supabase/client';
import { CartItem, CreateSaleInput, Discount, POSSale } from '@/types/pos';

export interface StockShortage {
  item_id: string;
  item_name: string;
  needed: number;
  available: number;
}

export interface StockAvailability {
  ok: boolean;
  shortages: StockShortage[];
}

type RpcError = { message?: string; code?: string; details?: string; hint?: string } | null;

/**
 * Thrown when the database is missing the ERP functions. The register must
 * refuse to sell in this state: selling without deduction silently corrupts
 * stock and food cost. Admins see the details on /admin/health.
 */
export class ErpNotInstalledError extends Error {
  readonly rpcName: string;

  constructor(rpcName: string) {
    super(
      `Stock engine is not installed (missing database function "${rpcName}"). ` +
        'Ask an administrator to apply the database migrations before using the register.'
    );
    this.name = 'ErpNotInstalledError';
    this.rpcName = rpcName;
  }
}

/** Thrown when the cart contains tracked items with no recipe or stock link. */
export class UnlinkedItemsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnlinkedItemsError';
  }
}

export const isRpcMissingError = (error: RpcError) => {
  const message = error?.message?.toLowerCase() || '';
  return (
    error?.code === 'PGRST202' ||
    error?.code === '42883' ||
    message.includes('could not find the function') ||
    (message.includes('function') && message.includes('does not exist'))
  );
};

const throwRpcError = (rpcName: string, error: NonNullable<RpcError>): never => {
  if (isRpcMissingError(error)) {
    throw new ErpNotInstalledError(rpcName);
  }
  if (error.hint === 'unlinked_items' || error.code === 'P0002') {
    throw new UnlinkedItemsError(error.message || 'Menu items are not linked to stock');
  }
  throw new Error(error.message || `${rpcName} failed`);
};

export const checkPosStockAvailability = async (
  items: CartItem[],
  branchId: string
): Promise<StockAvailability> => {
  const { data, error } = await supabase.rpc('check_pos_stock_availability', {
    p_items: items,
    p_branch_id: branchId,
  });

  if (error) throwRpcError('check_pos_stock_availability', error);

  return {
    ok: Boolean(data?.ok),
    shortages: Array.isArray(data?.shortages) ? data.shortages : [],
  };
};

export interface UnlinkedSaleItem {
  item_id: string;
  name: string;
}

export const listUnlinkedCartItems = async (items: CartItem[]): Promise<UnlinkedSaleItem[]> => {
  const { data, error } = await supabase.rpc('unlinked_sale_items', { p_items: items });
  if (error) {
    if (isRpcMissingError(error)) return [];
    throwRpcError('unlinked_sale_items', error);
  }
  return (data || []) as UnlinkedSaleItem[];
};

export const createPosOrder = async (input: CreateSaleInput): Promise<POSSale> => {
  const payload = {
    p_items: input.items,
    p_subtotal: input.subtotal,
    p_discount_type: input.discount_type,
    p_discount_value: input.discount_value,
    p_discount_amount: input.discount_amount,
    p_tax: input.tax,
    p_total_amount: input.total_amount,
    p_profit: input.profit,
    p_payment_method: input.payment_method,
    p_order_type: input.order_type,
    p_branch_id: input.branch_id,
    p_cashier_id: input.cashier_id,
    p_notes: input.notes ?? null,
    p_status: input.status ?? 'pending',
    p_table_number: input.table_number ?? null,
    p_customer_name: input.customer_name ?? null,
    p_discounts: input.discounts ?? [],
    p_amount_tendered: input.amount_tendered ?? null,
  };

  const { data, error } = await supabase.rpc('create_pos_order', payload);
  if (error) throwRpcError('create_pos_order', error);
  return data as POSSale;
};

export const updatePosOrderStatus = async (
  orderId: string,
  status: string,
  reason?: string
): Promise<POSSale> => {
  // Live DBs still have the 2-argument RPC. Try that first so status updates
  // do not error on every click, then the 3-argument version if it exists.
  const twoArg = await supabase.rpc('update_pos_order_status', {
    p_order_id: orderId,
    p_status: status,
  });
  if (!twoArg.error) return twoArg.data as POSSale;

  const threeArg = await supabase.rpc('update_pos_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_reason: reason ?? null,
  });
  if (!threeArg.error) return threeArg.data as POSSale;

  throwRpcError('update_pos_order_status', threeArg.error || twoArg.error);
};

export const adjustLocationStock = async (params: {
  itemId: string;
  locationId: string;
  quantity: number;
  movementType: string;
  notes?: string;
}): Promise<number> => {
  const { data, error } = await supabase.rpc('adjust_location_stock', {
    p_item_id: params.itemId,
    p_location_id: params.locationId,
    p_quantity: params.quantity,
    p_movement_type: params.movementType,
    p_notes: params.notes ?? null,
  });

  if (error) throwRpcError('adjust_location_stock', error);
  return Number(data);
};

export const fulfillStockRequestRpc = async (requestId: string, quantity: number) => {
  const { data, error } = await supabase.rpc('fulfill_stock_request', {
    p_request_id: requestId,
    p_quantity: quantity,
  });

  if (error) throwRpcError('fulfill_stock_request', error);
  return data;
};

export const transferStockRpc = async (params: {
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  notes?: string;
}) => {
  const { data, error } = await supabase.rpc('transfer_stock', {
    p_item_id: params.itemId,
    p_from_location_id: params.fromLocationId,
    p_to_location_id: params.toLocationId,
    p_quantity: params.quantity,
    p_notes: params.notes ?? null,
  });

  if (error) throwRpcError('transfer_stock', error);
  return data;
};

export const formatShortageMessage = (shortages: StockShortage[]): string => {
  if (!shortages.length) return '';
  return shortages
    .map(
      (item) =>
        `${item.item_name}: need ${Number(item.needed).toFixed(2)}, have ${Number(item.available).toFixed(2)}`
    )
    .join('; ');
};

export const summarizeDiscounts = (discounts: Discount[]) => {
  if (!discounts.length) {
    return { discount_type: 'none' as const, discount_value: 0 };
  }
  if (discounts.length === 1) {
    return { discount_type: discounts[0].type, discount_value: discounts[0].value };
  }
  return { discount_type: 'fixed' as const, discount_value: 0 };
};
