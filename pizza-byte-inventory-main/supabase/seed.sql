-- =============================================================================
-- Local development seed. Applied by `supabase db reset` only. Never run this
-- against production: it creates users with a well-known password.
--
-- Logins (password for all: password123)
--   admin@local.test      admin, no fixed location (picks a branch in the UI)
--   oceanmall@local.test  branch  -> Ocean Mall
--   warehouse@local.test  warehouse -> Main Warehouse
-- =============================================================================

-- Locations ------------------------------------------------------------------
INSERT INTO public.locations (id, name, type, address) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Ocean Mall', 'branch', 'Ocean Mall, Clifton, Karachi'),
  ('22222222-2222-2222-2222-222222222222', 'Main Warehouse', 'warehouse', 'Korangi Industrial Area, Karachi')
ON CONFLICT (id) DO NOTHING;

-- Users -----------------------------------------------------------------------
DO $$
DECLARE
  v_users jsonb := '[
    {"id": "aaaaaaaa-0000-0000-0000-000000000001", "email": "admin@local.test", "name": "Local Admin", "role": "admin", "location_id": null},
    {"id": "aaaaaaaa-0000-0000-0000-000000000002", "email": "oceanmall@local.test", "name": "Ocean Mall Cashier", "role": "branch", "location_id": "11111111-1111-1111-1111-111111111111"},
    {"id": "aaaaaaaa-0000-0000-0000-000000000003", "email": "warehouse@local.test", "name": "Warehouse Keeper", "role": "warehouse", "location_id": "22222222-2222-2222-2222-222222222222"}
  ]'::jsonb;
  u jsonb;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(v_users) LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = (u->>'id')::uuid) THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        (u->>'id')::uuid,
        'authenticated',
        'authenticated',
        u->>'email',
        extensions.crypt('password123', extensions.gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', u->>'name', 'role', u->>'role', 'location_id', u->'location_id'),
        now(), now(), '', '', '', ''
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        (u->>'id')::uuid,
        u->>'id',
        jsonb_build_object('sub', u->>'id', 'email', u->>'email', 'email_verified', true),
        'email',
        now(), now(), now()
      );
    END IF;
  END LOOP;
END $$;

-- handle_new_user already created the profiles; make sure roles are right even
-- if the trigger was bypassed.
UPDATE public.profiles p
SET role = v.role, location_id = v.location_id::uuid, name = v.name
FROM (VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'admin', NULL, 'Local Admin'),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'branch', '11111111-1111-1111-1111-111111111111', 'Ocean Mall Cashier'),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'warehouse', '22222222-2222-2222-2222-222222222222', 'Warehouse Keeper')
) AS v(id, role, location_id, name)
WHERE p.id = v.id;

-- Catalog ---------------------------------------------------------------------
INSERT INTO public.categories (id, name) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Dairy'),
  ('33333333-0000-0000-0000-000000000002', 'Dry Goods'),
  ('33333333-0000-0000-0000-000000000003', 'Beverages')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.inventory_items (id, name, category_id, unit_type, cost_per_unit, min_stock_threshold, base_unit, purchase_unit, purchase_conversion_value) VALUES
  ('44444444-0000-0000-0000-000000000001', 'Mozzarella', '33333333-0000-0000-0000-000000000001', 'grams', 1.2, 2000, 'grams', 'kg', 1000),
  ('44444444-0000-0000-0000-000000000002', 'Pizza Flour', '33333333-0000-0000-0000-000000000002', 'grams', 0.15, 5000, 'grams', 'bag', 20000),
  ('44444444-0000-0000-0000-000000000003', 'Pizza Sauce', '33333333-0000-0000-0000-000000000002', 'ml', 0.4, 1000, 'ml', 'liter', 1000),
  ('44444444-0000-0000-0000-000000000004', 'Pepsi 1.5L', '33333333-0000-0000-0000-000000000003', 'quantity', 120, 12, 'pcs', 'crate', 6)
ON CONFLICT (id) DO NOTHING;

-- Recipe: 12 inch cheese pizza ------------------------------------------------
INSERT INTO public.recipes (id, name, description) VALUES
  ('55555555-0000-0000-0000-000000000001', 'Cheese Pizza 12 inch', 'Seed recipe')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.recipe_items (recipe_id, item_id, quantity)
SELECT '55555555-0000-0000-0000-000000000001', v.item_id, v.qty
FROM (VALUES
  ('44444444-0000-0000-0000-000000000002'::uuid, 450),
  ('44444444-0000-0000-0000-000000000003'::uuid, 90),
  ('44444444-0000-0000-0000-000000000001'::uuid, 180)
) AS v(item_id, qty)
WHERE NOT EXISTS (
  SELECT 1 FROM public.recipe_items WHERE recipe_id = '55555555-0000-0000-0000-000000000001'
);

-- POS menu --------------------------------------------------------------------
INSERT INTO public.pos_categories (id, name, display_order) VALUES
  ('66666666-0000-0000-0000-000000000001', 'Pizza', 1),
  ('66666666-0000-0000-0000-000000000002', 'Drinks', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pos_items (id, name, category_id, price, recipe_id, available) VALUES
  ('77777777-0000-0000-0000-000000000001', 'Cheese Pizza 12"', '66666666-0000-0000-0000-000000000001', 120000, '55555555-0000-0000-0000-000000000001', true)
ON CONFLICT (id) DO NOTHING;

-- Pepsi is sold as a 1:1 stock item (no recipe). The inventory_item_id column
-- is added by a later migration; set it only if that column exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pos_items' AND column_name = 'inventory_item_id'
  ) THEN
    INSERT INTO public.pos_items (id, name, category_id, price, inventory_item_id, inventory_qty, available)
    VALUES ('77777777-0000-0000-0000-000000000002', 'Pepsi 1.5L', '66666666-0000-0000-0000-000000000002', 25000, '44444444-0000-0000-0000-000000000004', 1, true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Opening stock ---------------------------------------------------------------
INSERT INTO public.stock_entries (item_id, location_id, date, opening_stock, closing_stock)
SELECT v.item_id, v.location_id, CURRENT_DATE, v.qty, v.qty
FROM (VALUES
  ('44444444-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 10000),
  ('44444444-0000-0000-0000-000000000002'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 40000),
  ('44444444-0000-0000-0000-000000000003'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 5000),
  ('44444444-0000-0000-0000-000000000004'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 24),
  ('44444444-0000-0000-0000-000000000001'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 100000),
  ('44444444-0000-0000-0000-000000000002'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 400000),
  ('44444444-0000-0000-0000-000000000003'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 50000),
  ('44444444-0000-0000-0000-000000000004'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 240)
) AS v(item_id, location_id, qty)
WHERE NOT EXISTS (
  SELECT 1 FROM public.stock_entries se WHERE se.item_id = v.item_id AND se.location_id = v.location_id
);
