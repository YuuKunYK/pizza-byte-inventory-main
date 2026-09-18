-- =============================================================================
-- Unified activity logging.
--
--  * One canonical vocabulary for entity_type (see CHECK below).
--  * Catalog tables get an audit trigger so every create/update/delete is
--    logged with before/after regardless of which client wrote it.
--  * pos_sales logs order creation and every status change (voids with reason).
--  * Manual stock adjustments, transfers and request fulfilment log themselves.
--  * Clients call log_activity() for UI-level events; direct INSERTs are gone.
--  * Logs are readable by admins and by staff of the affected location only.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Normalise the legacy rows so the vocabulary CHECK can be enforced for new
-- rows (NOT VALID keeps the migration safe if unknown values exist elsewhere).
-- -----------------------------------------------------------------------------
UPDATE public.activity_logs SET entity_type = 'inventory_item'  WHERE entity_type IN ('inventory_items', 'inventory');
UPDATE public.activity_logs SET entity_type = 'stock_request'   WHERE entity_type IN ('stock_requests');
UPDATE public.activity_logs SET entity_type = 'stock_entry'     WHERE entity_type IN ('stock_entries');
UPDATE public.activity_logs SET entity_type = 'recipe'          WHERE entity_type IN ('recipes');
UPDATE public.activity_logs SET entity_type = 'profile'         WHERE entity_type IN ('profiles');
UPDATE public.activity_logs SET entity_type = 'location'        WHERE entity_type IN ('locations');
UPDATE public.activity_logs SET entity_type = 'pos_sale'        WHERE entity_type IN ('sales', 'pos_sales');

ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_entity_type_chk;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_entity_type_chk CHECK (entity_type IN (
  'pos_sale', 'pos_item', 'pos_category', 'discount_rule',
  'inventory_item', 'category', 'stock_entry', 'stock_request', 'transfer',
  'recipe', 'recipe_item', 'profile', 'location', 'settings', 'system'
)) NOT VALID;

ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- log_activity: the only write path. SECURITY DEFINER so RLS never blocks it;
-- user_id always comes from the session, never from the caller.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.log_activity(uuid, text, text, text, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_location_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details, location_id, organization_id)
  VALUES (
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_details, '{}'::jsonb),
    COALESCE(p_location_id, public.current_profile_location_id()),
    (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity(text, text, text, jsonb, uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- Generic audit trigger for catalog tables
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_changed jsonb;
  v_entity_id text;
  v_location uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    -- Only keep the columns that actually changed (ignoring updated_at noise).
    SELECT jsonb_object_agg(a.key, jsonb_build_object('from', v_before -> a.key, 'to', a.value))
    INTO v_changed
    FROM jsonb_each(v_after) a
    WHERE a.key <> 'updated_at' AND (v_before -> a.key) IS DISTINCT FROM a.value;
    IF v_changed IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    v_action := 'deleted';
    v_before := to_jsonb(OLD);
  END IF;

  v_entity_id := COALESCE(v_after ->> 'id', v_before ->> 'id');
  v_location := NULLIF(COALESCE(v_after ->> 'location_id', v_before ->> 'location_id', v_after ->> 'branch_id', v_before ->> 'branch_id'), '')::uuid;

  PERFORM public.log_activity(
    v_action,
    v_entity,
    v_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'name', COALESCE(v_after ->> 'name', v_before ->> 'name'),
      'changes', v_changed,
      'before', CASE WHEN TG_OP = 'DELETE' THEN v_before END,
      'after', CASE WHEN TG_OP = 'INSERT' THEN v_after END
    )),
    v_location
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('inventory_items', 'inventory_item'),
    ('categories', 'category'),
    ('recipes', 'recipe'),
    ('recipe_items', 'recipe_item'),
    ('pos_items', 'pos_item'),
    ('pos_categories', 'pos_category'),
    ('discount_rules', 'discount_rule'),
    ('locations', 'location'),
    ('organization_settings', 'settings')
  ) AS v(table_name, entity)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t.table_name, t.table_name);
    EXECUTE format(
      'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_row_change(%L)',
      t.table_name, t.table_name, t.entity
    );
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Orders: creation and every status change, including void reason
-- -----------------------------------------------------------------------------
ALTER TABLE public.pos_sales ADD COLUMN IF NOT EXISTS cancel_reason text;

CREATE OR REPLACE FUNCTION public.audit_pos_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_activity(
      'order_created', 'pos_sale', NEW.id::text,
      jsonb_build_object(
        'order_number', NEW.order_number,
        'order_type', NEW.order_type,
        'payment_method', NEW.payment_method,
        'total_amount', NEW.total_amount,
        'discount_amount', NEW.discount_amount,
        'item_count', jsonb_array_length(COALESCE(NEW.items, '[]'::jsonb)),
        'unlinked_items', NEW.unlinked_items
      ),
      NEW.branch_id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity(
      CASE WHEN NEW.status = 'cancelled' THEN 'order_cancelled' ELSE 'order_status_changed' END,
      'pos_sale', NEW.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'order_number', NEW.order_number,
        'from', OLD.status,
        'to', NEW.status,
        'total_amount', NEW.total_amount,
        'stock_restored', CASE WHEN NEW.status = 'cancelled' THEN (OLD.inventory_deducted AND NOT NEW.inventory_deducted) END,
        'reason', NEW.cancel_reason
      )),
      NEW.branch_id
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_activity(
      'order_deleted', 'pos_sale', OLD.id::text,
      jsonb_build_object('order_number', OLD.order_number, 'total_amount', OLD.total_amount),
      OLD.branch_id
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_pos_sales ON public.pos_sales;
CREATE TRIGGER audit_pos_sales
  AFTER INSERT OR UPDATE OR DELETE ON public.pos_sales
  FOR EACH ROW EXECUTE FUNCTION public.audit_pos_sale();

-- Sales are never deleted, only voided.
DROP POLICY IF EXISTS pos_sales_delete ON public.pos_sales;

-- update_pos_order_status gains an optional reason (required for cancellation
-- after the kitchen has the ticket).
DROP FUNCTION IF EXISTS public.update_pos_order_status(uuid, text);

CREATE OR REPLACE FUNCTION public.update_pos_order_status(
  p_order_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
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
  rec RECORD;
BEGIN
  IF p_status NOT IN ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status';
  END IF;

  IF v_role NOT IN ('admin', 'branch') THEN
    RAISE EXCEPTION 'Not allowed to update POS orders';
  END IF;

  SELECT * INTO v_sale FROM public.pos_sales WHERE id = p_order_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_role = 'branch' AND v_sale.branch_id IS DISTINCT FROM v_loc THEN
    RAISE EXCEPTION 'Cannot update orders for another branch';
  END IF;

  IF v_sale.status IN ('completed', 'cancelled') AND p_status <> v_sale.status THEN
    RAISE EXCEPTION 'Cannot change a % order', v_sale.status;
  END IF;

  IF p_status = 'cancelled' AND v_sale.status <> 'pending' AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reason is required to cancel an order the kitchen has already started'
      USING ERRCODE = 'P0003', HINT = 'reason_required';
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
      cancel_reason = CASE WHEN p_status = 'cancelled' THEN NULLIF(btrim(p_reason), '') ELSE cancel_reason END,
      served_time = CASE
        WHEN p_status IN ('served', 'completed') AND served_time IS NULL THEN now()
        ELSE served_time
      END
  WHERE id = p_order_id
  RETURNING * INTO v_sale;

  RETURN v_sale;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pos_order_status(uuid, text, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Stock RPCs log themselves (the movement ledger stays the source of truth;
-- the activity log is the human-readable timeline).
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
  v_new numeric;
  v_name text;
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

  v_new := public.apply_stock_delta(
    p_item_id, p_location_id, v_delta, p_movement_type, 'manual', NULL, p_notes, false
  );

  SELECT name INTO v_name FROM public.inventory_items WHERE id = p_item_id;
  PERFORM public.log_activity(
    'stock_adjusted', 'stock_entry', p_item_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'item_name', v_name, 'movement_type', p_movement_type,
      'quantity', v_delta, 'closing_stock', v_new, 'notes', p_notes
    )),
    p_location_id
  );

  RETURN v_new;
END;
$$;

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
  v_name text;
BEGIN
  IF v_role NOT IN ('admin', 'branch', 'warehouse') THEN
    RAISE EXCEPTION 'Not allowed to transfer stock';
  END IF;
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

  SELECT name INTO v_name FROM public.inventory_items WHERE id = p_item_id;
  PERFORM public.log_activity(
    'stock_transferred', 'transfer', p_item_id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'item_name', v_name, 'quantity', p_quantity,
      'from_location_id', p_from_location_id, 'to_location_id', p_to_location_id, 'notes', p_notes
    )),
    p_from_location_id
  );
  RETURN true;
END;
$$;

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
  IF v_role NOT IN ('admin', 'branch', 'warehouse') THEN
    RAISE EXCEPTION 'Not allowed to fulfill stock requests';
  END IF;

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

  PERFORM public.log_activity(
    CASE WHEN v_status = 'fulfilled' THEN 'request_fulfilled' ELSE 'request_partially_fulfilled' END,
    'stock_request', v_req.id::text,
    jsonb_build_object(
      'item_id', v_req.item_id, 'quantity', p_quantity,
      'dispatched_quantity', v_req.dispatched_quantity, 'requested_quantity', v_req.requested_quantity,
      'from_location_id', v_req.from_location_id, 'to_location_id', v_req.to_location_id
    ),
    v_req.from_location_id
  );

  RETURN v_req;
END;
$$;

-- -----------------------------------------------------------------------------
-- RLS: admins see everything; staff see their own location's log.
-- No INSERT policy: writes only happen through SECURITY DEFINER functions.
-- -----------------------------------------------------------------------------
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Insert own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_select ON public.activity_logs;

CREATE POLICY activity_logs_select ON public.activity_logs FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (location_id IS NOT NULL AND location_id = public.current_profile_location_id())
  );

CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON public.activity_logs(action);
