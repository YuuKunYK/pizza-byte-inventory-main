-- =============================================================================
-- POS items can deduct stock in two ways:
--   * recipe_id          -> explode the recipe's ingredients (pizzas, meals)
--   * inventory_item_id  -> 1:1 stock item, e.g. one Pepsi 1.5L = 1 unit (drinks)
-- Items that are inventory_tracked but have neither link are "unlinked". The
-- pos.unlinked_items setting decides whether the register blocks the sale
-- (default) or allows it while flagging the order.
-- =============================================================================

ALTER TABLE public.pos_items
  ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inventory_qty numeric NOT NULL DEFAULT 1 CHECK (inventory_qty > 0),
  ADD COLUMN IF NOT EXISTS inventory_tracked boolean NOT NULL DEFAULT true;

ALTER TABLE public.pos_items DROP CONSTRAINT IF EXISTS pos_items_single_link_chk;
ALTER TABLE public.pos_items ADD CONSTRAINT pos_items_single_link_chk
  CHECK (NOT (recipe_id IS NOT NULL AND inventory_item_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_pos_items_inventory_item ON public.pos_items(inventory_item_id);

COMMENT ON COLUMN public.pos_items.inventory_item_id IS 'Direct 1:1 stock link used when the item is not a recipe.';
COMMENT ON COLUMN public.pos_items.inventory_qty IS 'Base units of inventory_item_id consumed per unit sold.';
COMMENT ON COLUMN public.pos_items.inventory_tracked IS 'False for items that legitimately move no stock (service charges, delivery fee).';

ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS unlinked_items jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pos_sales.unlinked_items IS 'Names of tracked items that moved no stock because they had no recipe/stock link (only when policy allows).';

-- -----------------------------------------------------------------------------
-- Settings helper
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.setting_text(p_key text, p_default text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE
              WHEN jsonb_typeof(value) = 'string' THEN value #>> '{}'
              ELSE value::text
            END
     FROM public.organization_settings WHERE key = p_key),
    p_default
  );
$$;

GRANT EXECUTE ON FUNCTION public.setting_text(text, text) TO authenticated;

INSERT INTO public.organization_settings (key, value)
SELECT 'pos.unlinked_items', to_jsonb('block'::text)
WHERE NOT EXISTS (SELECT 1 FROM public.organization_settings WHERE key = 'pos.unlinked_items');

-- -----------------------------------------------------------------------------
-- Ingredient expansion: recipes + direct stock links
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expand_sale_ingredients(p_items jsonb)
RETURNS TABLE(item_id uuid, qty numeric)
LANGUAGE sql
STABLE
AS $$
  WITH lines AS (
    SELECT (sale_item->>'item_id')::uuid AS pos_item_id,
           COALESCE((sale_item->>'quantity')::numeric, 0) AS sold_qty
    FROM jsonb_array_elements(p_items) AS sale_item
  ),
  recipe_part AS (
    SELECT public.recipe_line_item_id(to_jsonb(ri)) AS item_id,
           COALESCE(ri.quantity, 0) * l.sold_qty AS qty
    FROM lines l
    JOIN public.pos_items pi ON pi.id = l.pos_item_id
    JOIN public.recipe_items ri ON ri.recipe_id = pi.recipe_id
    WHERE pi.recipe_id IS NOT NULL
  ),
  direct_part AS (
    SELECT pi.inventory_item_id AS item_id,
           COALESCE(pi.inventory_qty, 1) * l.sold_qty AS qty
    FROM lines l
    JOIN public.pos_items pi ON pi.id = l.pos_item_id
    WHERE pi.inventory_item_id IS NOT NULL
  )
  SELECT x.item_id, SUM(x.qty) AS qty
  FROM (SELECT * FROM recipe_part UNION ALL SELECT * FROM direct_part) x
  WHERE x.item_id IS NOT NULL
  GROUP BY x.item_id
  HAVING SUM(x.qty) > 0;
$$;

-- Tracked items in a cart that would move no stock.
CREATE OR REPLACE FUNCTION public.unlinked_sale_items(p_items jsonb)
RETURNS TABLE(item_id uuid, name text)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT pi.id, pi.name
  FROM jsonb_array_elements(p_items) AS sale_item
  JOIN public.pos_items pi ON pi.id = (sale_item->>'item_id')::uuid
  WHERE pi.inventory_tracked
    AND pi.recipe_id IS NULL
    AND pi.inventory_item_id IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.unlinked_sale_items(jsonb) TO authenticated;

-- -----------------------------------------------------------------------------
-- create_pos_order: same signature, now enforces the unlinked-items policy and
-- records which items (if any) moved no stock.
-- -----------------------------------------------------------------------------
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
  v_unlinked jsonb;
  v_policy text := public.setting_text('pos.unlinked_items', 'block');
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

  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = p_branch_id AND type = 'branch') THEN
    RAISE EXCEPTION 'Orders can only be placed at a branch location';
  END IF;

  SELECT COALESCE(jsonb_agg(u.name ORDER BY u.name), '[]'::jsonb)
  INTO v_unlinked
  FROM public.unlinked_sale_items(p_items) u;

  IF jsonb_array_length(v_unlinked) > 0 AND v_policy <> 'allow_with_flag' THEN
    RAISE EXCEPTION 'These menu items are not linked to a recipe or stock item and cannot be sold: %',
      (SELECT string_agg(x, ', ') FROM jsonb_array_elements_text(v_unlinked) x)
      USING ERRCODE = 'P0002', HINT = 'unlinked_items';
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
    change_due, inventory_deducted, unlinked_items, order_number, order_time
  ) VALUES (
    p_items, p_subtotal, COALESCE(p_discount_type, 'none'), COALESCE(p_discount_value, 0),
    COALESCE(p_discount_amount, 0), COALESCE(p_tax, 0), p_total_amount, COALESCE(p_profit, 0),
    p_payment_method, p_order_type, p_branch_id, p_cashier_id, p_notes,
    COALESCE(p_status, 'pending'), p_table_number, p_customer_name,
    COALESCE(p_discounts, '[]'::jsonb), p_amount_tendered, v_change, false, v_unlinked,
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

-- -----------------------------------------------------------------------------
-- Cost of a POS item now also covers 1:1 stock links. Recreate the trigger so
-- it fires for inventory link changes as well.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_pos_item_cost()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_cost numeric := 0;
BEGIN
  IF NEW.recipe_id IS NOT NULL THEN
    SELECT COALESCE(SUM(COALESCE(ri.quantity, 0) * COALESCE(ii.cost_per_unit, 0) * 100), 0)
    INTO total_cost
    FROM public.recipe_items ri
    JOIN public.inventory_items ii ON ii.id = public.recipe_line_item_id(to_jsonb(ri))
    WHERE ri.recipe_id = NEW.recipe_id;
    NEW.cost_per_item := ROUND(total_cost)::integer;
  ELSIF NEW.inventory_item_id IS NOT NULL THEN
    SELECT COALESCE(ii.cost_per_unit, 0) * COALESCE(NEW.inventory_qty, 1) * 100
    INTO total_cost
    FROM public.inventory_items ii
    WHERE ii.id = NEW.inventory_item_id;
    NEW.cost_per_item := ROUND(COALESCE(total_cost, 0))::integer;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calculate_cost_on_recipe_link ON public.pos_items;
CREATE TRIGGER calculate_cost_on_recipe_link
  BEFORE INSERT OR UPDATE OF recipe_id, inventory_item_id, inventory_qty ON public.pos_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_pos_item_cost();
