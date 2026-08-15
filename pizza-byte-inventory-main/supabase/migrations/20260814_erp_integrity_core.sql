-- =============================================================================
-- ERP integrity core
-- Connects POS → recipes → ingredients → branch stock_entries atomically.
-- Replaces the broken inventory_items.current_stock deduct trigger.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Auth helpers (profiles, never JWT "role" which is always "authenticated")
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role::text FROM public.profiles WHERE id = auth.uid()), 'none');
$$;

CREATE OR REPLACE FUNCTION public.current_profile_location_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_profile_role() = 'admin';
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_location_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Schema additions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  plan text NOT NULL DEFAULT 'starter',
  subscription_status text NOT NULL DEFAULT 'trialing',
  restaurant_name text,
  tax_rate numeric NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
  currency text NOT NULL DEFAULT 'PKR',
  timezone text NOT NULL DEFAULT 'Asia/Karachi',
  billing_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (name, slug, plan, subscription_status, restaurant_name)
SELECT 'Default Organization', 'default', 'professional', 'active', 'New York Pizza'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations);

ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS inventory_deducted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS amount_tendered integer,
  ADD COLUMN IF NOT EXISTS change_due integer;

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  quantity numeric NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN (
    'warehouse_receiving', 'local_purchasing', 'transfer_in', 'transfer_out',
    'discarded', 'sale', 'sale_void', 'adjustment'
  )),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_location ON public.inventory_movements(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_ref ON public.inventory_movements(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 3. Recipe ingredient id (supports inventory_item_id OR legacy item_id)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recipe_line_item_id(ri jsonb)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((ri->>'inventory_item_id')::uuid, (ri->>'item_id')::uuid);
$$;

-- -----------------------------------------------------------------------------
-- 4. Locked stock ledger: one current row per item+location (latest date)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_stock_entry(p_item_id uuid, p_location_id uuid)
RETURNS public.stock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.stock_entries;
BEGIN
  SELECT * INTO v_entry
  FROM public.stock_entries
  WHERE item_id = p_item_id AND location_id = p_location_id
  ORDER BY date DESC NULLS LAST, updated_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_entry.id IS NULL THEN
    INSERT INTO public.stock_entries (
      item_id, location_id, date, opening_stock, warehouse_receiving,
      local_purchasing, transfer_in, transfer_out, discarded, closing_stock
    ) VALUES (
      p_item_id, p_location_id, CURRENT_DATE, 0, 0, 0, 0, 0, 0, 0
    )
    RETURNING * INTO v_entry;
  END IF;

  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_stock_delta(
  p_item_id uuid,
  p_location_id uuid,
  p_delta numeric,
  p_movement_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_allow_negative boolean DEFAULT false
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.stock_entries;
  v_new numeric;
  v_col text;
BEGIN
  IF p_delta = 0 THEN
    RETURN COALESCE((
      SELECT closing_stock FROM public.stock_entries
      WHERE item_id = p_item_id AND location_id = p_location_id
      ORDER BY date DESC NULLS LAST LIMIT 1
    ), 0);
  END IF;

  v_entry := public.get_or_create_stock_entry(p_item_id, p_location_id);
  v_new := COALESCE(v_entry.closing_stock, 0) + p_delta;

  IF v_new < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'Insufficient stock for item % at location % (have %, need %)',
      p_item_id, p_location_id, COALESCE(v_entry.closing_stock, 0), abs(p_delta)
      USING ERRCODE = 'P0001';
  END IF;

  v_col := CASE p_movement_type
    WHEN 'warehouse_receiving' THEN 'warehouse_receiving'
    WHEN 'local_purchasing' THEN 'local_purchasing'
    WHEN 'transfer_in' THEN 'transfer_in'
    WHEN 'transfer_out' THEN 'transfer_out'
    WHEN 'discarded' THEN 'discarded'
    ELSE NULL
  END;

  IF v_col IS NOT NULL THEN
    EXECUTE format(
      'UPDATE public.stock_entries SET %I = COALESCE(%I, 0) + $1, closing_stock = $2, updated_at = now() WHERE id = $3',
      v_col, v_col
    ) USING abs(p_delta), v_new, v_entry.id;
  ELSE
    UPDATE public.stock_entries
    SET closing_stock = v_new, updated_at = now()
    WHERE id = v_entry.id;
  END IF;

  INSERT INTO public.inventory_movements (
    item_id, location_id, quantity, movement_type, reference_type, reference_id, notes, created_by
  ) VALUES (
    p_item_id, p_location_id, p_delta, p_movement_type, p_reference_type, p_reference_id, p_notes, auth.uid()
  );

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_stock_delta(uuid, uuid, numeric, text, text, uuid, text, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Expand a POS cart into ingredient requirements at a branch
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expand_sale_ingredients(p_items jsonb)
RETURNS TABLE(item_id uuid, qty numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT public.recipe_line_item_id(to_jsonb(ri)) AS item_id,
         SUM(COALESCE(ri.quantity, 0) * COALESCE((sale_item->>'quantity')::numeric, 0)) AS qty
  FROM jsonb_array_elements(p_items) AS sale_item
  JOIN public.pos_items pi ON pi.id = (sale_item->>'item_id')::uuid
  JOIN public.recipe_items ri ON ri.recipe_id = pi.recipe_id
  WHERE pi.recipe_id IS NOT NULL
    AND public.recipe_line_item_id(to_jsonb(ri)) IS NOT NULL
  GROUP BY 1
  HAVING SUM(COALESCE(ri.quantity, 0) * COALESCE((sale_item->>'quantity')::numeric, 0)) > 0;
$$;

CREATE OR REPLACE FUNCTION public.check_pos_stock_availability(p_items jsonb, p_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shortages jsonb := '[]'::jsonb;
  rec RECORD;
  v_have numeric;
  v_name text;
BEGIN
  FOR rec IN SELECT * FROM public.expand_sale_ingredients(p_items)
  LOOP
    SELECT COALESCE(se.closing_stock, 0) INTO v_have
    FROM (
      SELECT closing_stock FROM public.stock_entries
      WHERE item_id = rec.item_id AND location_id = p_branch_id
      ORDER BY date DESC NULLS LAST LIMIT 1
    ) se;

    v_have := COALESCE(v_have, 0);

    IF v_have < rec.qty THEN
      SELECT name INTO v_name FROM public.inventory_items WHERE id = rec.item_id;
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'item_id', rec.item_id,
        'item_name', COALESCE(v_name, 'Unknown ingredient'),
        'needed', rec.qty,
        'available', v_have
      ));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', jsonb_array_length(v_shortages) = 0, 'shortages', v_shortages);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_pos_stock_availability(jsonb, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 6. Create POS order + deduct branch stock in one transaction
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  date_part text := to_char(now(), 'YYYYMMDD');
  sequence_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('pos_order_' || date_part));
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM public.pos_sales
  WHERE order_number LIKE 'ORD-' || date_part || '-%';
  RETURN 'ORD-' || date_part || '-' || lpad(sequence_num::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.create_pos_order(
  p_items jsonb,
  p_subtotal integer,
  p_discount_type text,
  p_discount_value numeric,
  p_discount_amount integer,
  p_tax integer,
  p_total_amount integer,
  p_profit integer,
  p_payment_method text,
  p_order_type text,
  p_branch_id uuid,
  p_cashier_id uuid,
  p_notes text DEFAULT NULL,
  p_status text DEFAULT 'pending',
  p_table_number text DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_discounts jsonb DEFAULT '[]'::jsonb,
  p_amount_tendered integer DEFAULT NULL
)
RETURNS public.pos_sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_profile_role();
  v_loc uuid := public.current_profile_location_id();
  v_sale public.pos_sales;
  v_check jsonb;
  rec RECORD;
  v_change integer;
BEGIN
  IF v_role NOT IN ('admin', 'branch') THEN
    RAISE EXCEPTION 'Only admin and branch users can create POS orders';
  END IF;

  IF v_role = 'branch' AND (v_loc IS NULL OR v_loc <> p_branch_id) THEN
    RAISE EXCEPTION 'Branch users can only create orders for their own location';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  v_check := public.check_pos_stock_availability(p_items, p_branch_id);
  IF (v_check->>'ok')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Insufficient ingredient stock: %', v_check->>'shortages'
      USING ERRCODE = 'P0001';
  END IF;

  v_change := CASE
    WHEN p_amount_tendered IS NOT NULL THEN GREATEST(p_amount_tendered - p_total_amount, 0)
    ELSE NULL
  END;

  INSERT INTO public.pos_sales (
    items, subtotal, discount_type, discount_value, discount_amount, tax,
    total_amount, profit, payment_method, order_type, branch_id, cashier_id,
    notes, status, table_number, customer_name, discounts, amount_tendered,
    change_due, inventory_deducted, order_number, order_time
  ) VALUES (
    p_items, p_subtotal, COALESCE(p_discount_type, 'none'), COALESCE(p_discount_value, 0),
    COALESCE(p_discount_amount, 0), COALESCE(p_tax, 0), p_total_amount, COALESCE(p_profit, 0),
    p_payment_method, p_order_type, p_branch_id, p_cashier_id, p_notes,
    COALESCE(p_status, 'pending'), p_table_number, p_customer_name,
    COALESCE(p_discounts, '[]'::jsonb), p_amount_tendered, v_change, false,
    public.generate_order_number(), now()
  )
  RETURNING * INTO v_sale;

  FOR rec IN SELECT * FROM public.expand_sale_ingredients(p_items)
  LOOP
    PERFORM public.apply_stock_delta(
      rec.item_id, p_branch_id, -rec.qty, 'sale', 'pos_sale', v_sale.id,
      'POS sale ' || v_sale.order_number, false
    );
  END LOOP;

  UPDATE public.pos_sales SET inventory_deducted = true WHERE id = v_sale.id
  RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pos_order(
  jsonb, integer, text, numeric, integer, integer, integer, integer, text, text,
  uuid, uuid, text, text, text, text, jsonb, integer
) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Status changes + restore stock on cancel
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_pos_order_status(p_order_id uuid, p_status text)
RETURNS public.pos_sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_profile_role();
  v_loc uuid := public.current_profile_location_id();
  v_sale public.pos_sales;
  rec RECORD;
BEGIN
  IF p_status NOT IN ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status';
  END IF;

  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_order_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_role = 'branch' AND v_sale.branch_id IS DISTINCT FROM v_loc THEN
    RAISE EXCEPTION 'Cannot update orders for another branch';
  END IF;

  IF v_role NOT IN ('admin', 'branch') THEN
    RAISE EXCEPTION 'Not allowed to update POS orders';
  END IF;

  IF v_sale.status IN ('completed', 'cancelled') AND p_status <> v_sale.status THEN
    RAISE EXCEPTION 'Cannot change a % order', v_sale.status;
  END IF;

  IF p_status = 'cancelled' AND v_sale.inventory_deducted THEN
    FOR rec IN SELECT * FROM public.expand_sale_ingredients(v_sale.items)
    LOOP
      PERFORM public.apply_stock_delta(
        rec.item_id, v_sale.branch_id, rec.qty, 'sale_void', 'pos_sale', v_sale.id,
        'Void ' || v_sale.order_number, true
      );
    END LOOP;
    v_sale.inventory_deducted := false;
  END IF;

  UPDATE public.pos_sales
  SET status = p_status,
      inventory_deducted = v_sale.inventory_deducted,
      served_time = CASE
        WHEN p_status IN ('served', 'completed') AND served_time IS NULL THEN now()
        ELSE served_time
      END
  WHERE id = p_order_id
  RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pos_order_status(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 8. Manual stock adjust (additive, never wipes other counters)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_location_stock(
  p_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_movement_type text,
  p_notes text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_profile_role();
  v_loc uuid := public.current_profile_location_id();
  v_delta numeric;
BEGIN
  IF v_role NOT IN ('admin', 'branch', 'warehouse') THEN
    RAISE EXCEPTION 'Not allowed to adjust stock';
  END IF;

  IF v_role <> 'admin' AND v_loc IS DISTINCT FROM p_location_id THEN
    RAISE EXCEPTION 'You can only adjust stock at your own location';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_movement_type IN ('warehouse_receiving', 'local_purchasing', 'transfer_in') THEN
    v_delta := p_quantity;
  ELSIF p_movement_type IN ('transfer_out', 'discarded') THEN
    v_delta := -p_quantity;
  ELSE
    RAISE EXCEPTION 'Invalid movement type';
  END IF;

  RETURN public.apply_stock_delta(
    p_item_id, p_location_id, v_delta, p_movement_type, 'manual', NULL, p_notes, false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_location_stock(uuid, uuid, numeric, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. Atomic stock-request fulfillment (transfer between locations)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_stock_request(p_request_id uuid, p_quantity numeric)
RETURNS public.stock_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.stock_requests;
  v_role text := public.current_profile_role();
  v_loc uuid := public.current_profile_location_id();
  v_status text;
BEGIN
  SELECT * INTO v_req FROM public.stock_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Stock request not found';
  END IF;

  IF v_req.status NOT IN ('pending', 'partial') THEN
    RAISE EXCEPTION 'Request cannot be fulfilled from status %', v_req.status;
  END IF;

  IF v_role <> 'admin' AND v_loc IS DISTINCT FROM v_req.from_location_id THEN
    RAISE EXCEPTION 'Only the sending location can fulfill this request';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Dispatch quantity must be greater than zero';
  END IF;

  IF p_quantity > (v_req.requested_quantity - COALESCE(v_req.dispatched_quantity, 0)) THEN
    RAISE EXCEPTION 'Cannot dispatch more than remaining requested quantity';
  END IF;

  PERFORM public.apply_stock_delta(
    v_req.item_id, v_req.from_location_id, -p_quantity, 'transfer_out',
    'stock_request', v_req.id, 'Fulfill request', false
  );
  PERFORM public.apply_stock_delta(
    v_req.item_id, v_req.to_location_id, p_quantity, 'transfer_in',
    'stock_request', v_req.id, 'Receive request', true
  );

  v_status := CASE
    WHEN COALESCE(v_req.dispatched_quantity, 0) + p_quantity >= v_req.requested_quantity THEN 'fulfilled'
    ELSE 'partial'
  END;

  UPDATE public.stock_requests
  SET status = v_status,
      dispatched_quantity = COALESCE(dispatched_quantity, 0) + p_quantity,
      fulfilled_by = auth.uid()
  WHERE id = p_request_id
  RETURNING * INTO v_req;

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfill_stock_request(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_item_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := public.current_profile_role();
  v_loc uuid := public.current_profile_location_id();
BEGIN
  IF p_from_location_id = p_to_location_id THEN
    RAISE EXCEPTION 'Source and destination must be different';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF v_role <> 'admin' AND v_loc IS DISTINCT FROM p_from_location_id THEN
    RAISE EXCEPTION 'You can only transfer stock out of your own location';
  END IF;

  PERFORM public.apply_stock_delta(
    p_item_id, p_from_location_id, -p_quantity, 'transfer_out', 'transfer', NULL, p_notes, false
  );
  PERFORM public.apply_stock_delta(
    p_item_id, p_to_location_id, p_quantity, 'transfer_in', 'transfer', NULL, p_notes, true
  );
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, numeric, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 10. Replace broken POS cost + deduct triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS deduct_inventory_after_sale ON public.pos_sales;
DROP FUNCTION IF EXISTS public.deduct_inventory_on_sale();

CREATE OR REPLACE FUNCTION public.calculate_pos_item_cost()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_cost numeric;
BEGIN
  IF NEW.recipe_id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      COALESCE(ri.quantity, 0) * COALESCE(ii.cost_per_unit, 0) * 100
    ), 0)
    INTO total_cost
    FROM public.recipe_items ri
    JOIN public.inventory_items ii
      ON ii.id = public.recipe_line_item_id(to_jsonb(ri))
    WHERE ri.recipe_id = NEW.recipe_id;

    NEW.cost_per_item := ROUND(total_cost)::integer;
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. RLS: POS tables keyed off profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Everyone can view categories" ON public.pos_categories;
DROP POLICY IF EXISTS "Admin can insert categories" ON public.pos_categories;
DROP POLICY IF EXISTS "Admin can update categories" ON public.pos_categories;
DROP POLICY IF EXISTS "Admin can delete categories" ON public.pos_categories;
DROP POLICY IF EXISTS "Everyone can view available items" ON public.pos_items;
DROP POLICY IF EXISTS "Admin can insert items" ON public.pos_items;
DROP POLICY IF EXISTS "Admin can update items" ON public.pos_items;
DROP POLICY IF EXISTS "Admin can delete items" ON public.pos_items;
DROP POLICY IF EXISTS "Everyone can view active discounts" ON public.discount_rules;
DROP POLICY IF EXISTS "Admin can insert discounts" ON public.discount_rules;
DROP POLICY IF EXISTS "Admin can update discounts" ON public.discount_rules;
DROP POLICY IF EXISTS "Admin can delete discounts" ON public.discount_rules;
DROP POLICY IF EXISTS "Admin can view all sales" ON public.pos_sales;
DROP POLICY IF EXISTS "Branch can view their own sales" ON public.pos_sales;
DROP POLICY IF EXISTS "Admin and Branch can insert sales" ON public.pos_sales;
DROP POLICY IF EXISTS "Admin can update sales" ON public.pos_sales;
DROP POLICY IF EXISTS "Branch can update their own sales" ON public.pos_sales;
DROP POLICY IF EXISTS "Admin can delete sales" ON public.pos_sales;

CREATE POLICY pos_categories_select ON public.pos_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY pos_categories_write ON public.pos_categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY pos_items_select ON public.pos_items FOR SELECT TO authenticated USING (true);
CREATE POLICY pos_items_write ON public.pos_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY discount_rules_select ON public.discount_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY discount_rules_write ON public.discount_rules FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY pos_sales_select ON public.pos_sales FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.current_profile_role() IN ('branch') AND branch_id = public.current_profile_location_id())
  );

CREATE POLICY pos_sales_insert ON public.pos_sales FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.current_profile_role() = 'branch' AND branch_id = public.current_profile_location_id())
  );

CREATE POLICY pos_sales_update ON public.pos_sales FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.current_profile_role() = 'branch' AND branch_id = public.current_profile_location_id())
  );

CREATE POLICY pos_sales_delete ON public.pos_sales FOR DELETE TO authenticated
  USING (public.is_admin());

-- Inventory movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventory_movements_select ON public.inventory_movements;
CREATE POLICY inventory_movements_select ON public.inventory_movements FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR location_id = public.current_profile_location_id()
  );

-- Organizations / settings readable by authenticated, writable by admin
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_select ON public.organizations;
DROP POLICY IF EXISTS organizations_write ON public.organizations;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY organizations_write ON public.organizations FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_settings_select ON public.organization_settings;
DROP POLICY IF EXISTS organization_settings_write ON public.organization_settings;
CREATE POLICY organization_settings_select ON public.organization_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY organization_settings_write ON public.organization_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Best-effort RLS on core inventory tables if they exist
DO $$
BEGIN
  IF to_regclass('public.stock_entries') IS NOT NULL THEN
    ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS stock_entries_select ON public.stock_entries;
    DROP POLICY IF EXISTS stock_entries_write ON public.stock_entries;
    CREATE POLICY stock_entries_select ON public.stock_entries FOR SELECT TO authenticated
      USING (public.is_admin() OR location_id = public.current_profile_location_id());
    CREATE POLICY stock_entries_write ON public.stock_entries FOR ALL TO authenticated
      USING (public.is_admin() OR location_id = public.current_profile_location_id())
      WITH CHECK (public.is_admin() OR location_id = public.current_profile_location_id());
  END IF;

  IF to_regclass('public.stock_requests') IS NOT NULL THEN
    ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS stock_requests_select ON public.stock_requests;
    DROP POLICY IF EXISTS stock_requests_write ON public.stock_requests;
    CREATE POLICY stock_requests_select ON public.stock_requests FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR from_location_id = public.current_profile_location_id()
        OR to_location_id = public.current_profile_location_id()
      );
    CREATE POLICY stock_requests_write ON public.stock_requests FOR ALL TO authenticated
      USING (
        public.is_admin()
        OR from_location_id = public.current_profile_location_id()
        OR to_location_id = public.current_profile_location_id()
      )
      WITH CHECK (
        public.is_admin()
        OR from_location_id = public.current_profile_location_id()
        OR to_location_id = public.current_profile_location_id()
      );
  END IF;

  IF to_regclass('public.inventory_items') IS NOT NULL THEN
    ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS inventory_items_select ON public.inventory_items;
    DROP POLICY IF EXISTS inventory_items_write ON public.inventory_items;
    CREATE POLICY inventory_items_select ON public.inventory_items FOR SELECT TO authenticated USING (true);
    CREATE POLICY inventory_items_write ON public.inventory_items FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF to_regclass('public.categories') IS NOT NULL THEN
    ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS categories_select ON public.categories;
    DROP POLICY IF EXISTS categories_write ON public.categories;
    CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (true);
    CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF to_regclass('public.locations') IS NOT NULL THEN
    ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS locations_select ON public.locations;
    DROP POLICY IF EXISTS locations_write ON public.locations;
    CREATE POLICY locations_select ON public.locations FOR SELECT TO authenticated USING (true);
    CREATE POLICY locations_write ON public.locations FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS profiles_select ON public.profiles;
    DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
    DROP POLICY IF EXISTS profiles_admin ON public.profiles;
    CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
      USING (public.is_admin() OR id = auth.uid());
    CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
      USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND role = public.current_profile_role());
    CREATE POLICY profiles_admin ON public.profiles FOR ALL TO authenticated
      USING (public.is_admin()) WITH CHECK (public.is_admin());
  END IF;

  IF to_regclass('public.recipes') IS NOT NULL THEN
    ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS recipes_select ON public.recipes;
    DROP POLICY IF EXISTS recipes_write ON public.recipes;
    CREATE POLICY recipes_select ON public.recipes FOR SELECT TO authenticated USING (true);
    CREATE POLICY recipes_write ON public.recipes FOR ALL TO authenticated
      USING (public.current_profile_role() IN ('admin', 'branch'))
      WITH CHECK (public.current_profile_role() IN ('admin', 'branch'));
  END IF;

  IF to_regclass('public.recipe_items') IS NOT NULL THEN
    ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS recipe_items_select ON public.recipe_items;
    DROP POLICY IF EXISTS recipe_items_write ON public.recipe_items;
    CREATE POLICY recipe_items_select ON public.recipe_items FOR SELECT TO authenticated USING (true);
    CREATE POLICY recipe_items_write ON public.recipe_items FOR ALL TO authenticated
      USING (public.current_profile_role() IN ('admin', 'branch'))
      WITH CHECK (public.current_profile_role() IN ('admin', 'branch'));
  END IF;
END $$;
