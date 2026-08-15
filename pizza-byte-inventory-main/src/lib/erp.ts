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

const rpcMissing = (error: { message?: string; code?: string } | null) => {
  const message = error?.message?.toLowerCase() || '';
  return (
    error?.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('does not exist')
  );
};

export const checkPosStockAvailability = async (
  items: CartItem[],
  branchId: string
): Promise<StockAvailability> => {
  const { data, error } = await supabase.rpc('check_pos_stock_availability', {
    p_items: items,
    p_branch_id: branchId,
  });

  if (error) {
    if (rpcMissing(error)) {
      return { ok: true, shortages: [] };
    }
    throw error;
  }

  return {
    ok: Boolean(data?.ok),
    shortages: Array.isArray(data?.shortages) ? data.shortages : [],
  };
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
  if (!error) return data as POSSale;
  if (!rpcMissing(error)) throw error;

  const { data: sale, error: insertError } = await supabase
    .from('pos_sales')
    .insert({
      items: input.items,
      subtotal: input.subtotal,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      discount_amount: input.discount_amount,
      tax: input.tax,
      total_amount: input.total_amount,
      profit: input.profit,
      payment_method: input.payment_method,
      order_type: input.order_type,
      branch_id: input.branch_id,
      cashier_id: input.cashier_id,
      notes: input.notes,
      status: input.status ?? 'pending',
      table_number: input.table_number,
      customer_name: input.customer_name,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return sale as POSSale;
};

export const updatePosOrderStatus = async (orderId: string, status: string): Promise<POSSale> => {
  const { data, error } = await supabase.rpc('update_pos_order_status', {
    p_order_id: orderId,
    p_status: status,
  });

  if (!error) return data as POSSale;
  if (!rpcMissing(error)) throw error;

  const { data: sale, error: updateError } = await supabase
    .from('pos_sales')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError) throw updateError;
  return sale as POSSale;
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

  if (error) throw error;
  return Number(data);
};

export const fulfillStockRequestRpc = async (requestId: string, quantity: number) => {
  const { data, error } = await supabase.rpc('fulfill_stock_request', {
    p_request_id: requestId,
    p_quantity: quantity,
  });

  if (error) throw error;
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

  if (error) throw error;
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
