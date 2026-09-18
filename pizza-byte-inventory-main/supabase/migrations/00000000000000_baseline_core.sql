-- =============================================================================
-- Baseline core schema
--
-- Creates the tables every later migration assumes already exist. Every
-- statement is idempotent so this file is safe to apply on a project that was
-- provisioned by hand before this baseline existed.
--
-- Columns are derived from the application code and the ERP RPCs; anything the
-- app never reads or writes is intentionally left out.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_type') THEN
    CREATE TYPE public.unit_type AS ENUM ('grams', 'kg', 'packet', 'quantity', 'liter', 'ml');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'base_unit_type') THEN
    CREATE TYPE public.base_unit_type AS ENUM ('grams', 'kg', 'ml', 'liter', 'pcs');
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Shared updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Locations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('branch', 'warehouse')),
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_locations_updated_at ON public.locations;
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Profiles (one row per auth user)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  name text,
  role text NOT NULL DEFAULT 'branch' CHECK (role IN ('admin', 'branch', 'warehouse')),
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_location_idx ON public.profiles(location_id);

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep a profile row for every auth user. Staff are created through the
-- staff-admin Edge Function which sets role/location in user metadata; this
-- trigger makes users created any other way (Studio, CLI) usable too.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(NEW.raw_user_meta_data->>'role', 'branch');
  v_location uuid := NULLIF(NEW.raw_user_meta_data->>'location_id', '')::uuid;
BEGIN
  IF v_role NOT IN ('admin', 'branch', 'warehouse') THEN
    v_role := 'branch';
  END IF;

  INSERT INTO public.profiles (id, email, name, role, location_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_role,
    v_location
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_type public.unit_type NOT NULL DEFAULT 'quantity',
  cost_per_unit numeric NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
  min_stock_threshold numeric DEFAULT 1,
  conversion_value numeric DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_items_category_idx ON public.inventory_items(category_id);

DROP TRIGGER IF EXISTS update_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Recipes (bill of materials per dish)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_recipes_updated_at ON public.recipes;
CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipe_items_recipe_idx ON public.recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS recipe_items_item_idx ON public.recipe_items(item_id);

DROP TRIGGER IF EXISTS update_recipe_items_updated_at ON public.recipe_items;
CREATE TRIGGER update_recipe_items_updated_at
  BEFORE UPDATE ON public.recipe_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Stock ledger: per item per location. The row with the latest date is the
-- live balance (closing_stock); apply_stock_delta always updates that row.
-- Historical rows are allowed, so there is deliberately no unique constraint.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  opening_stock numeric NOT NULL DEFAULT 0,
  warehouse_receiving numeric NOT NULL DEFAULT 0,
  local_purchasing numeric NOT NULL DEFAULT 0,
  transfer_in numeric NOT NULL DEFAULT 0,
  transfer_out numeric NOT NULL DEFAULT 0,
  discarded numeric NOT NULL DEFAULT 0,
  closing_stock numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_entries_item_location_date_idx
  ON public.stock_entries(item_id, location_id, date DESC);
CREATE INDEX IF NOT EXISTS stock_entries_location_idx ON public.stock_entries(location_id);

DROP TRIGGER IF EXISTS update_stock_entries_updated_at ON public.stock_entries;
CREATE TRIGGER update_stock_entries_updated_at
  BEFORE UPDATE ON public.stock_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Stock requests (branch asks warehouse). Constraint names match the PostgREST
-- relationship hints used by the client (stock_requests_from_location_id_fkey…).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  from_location_id uuid NOT NULL,
  to_location_id uuid NOT NULL,
  requested_quantity numeric NOT NULL CHECK (requested_quantity > 0),
  dispatched_quantity numeric NOT NULL DEFAULT 0 CHECK (dispatched_quantity >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'fulfilled', 'rejected')),
  notes text,
  requested_by uuid,
  fulfilled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_requests_item_id_fkey FOREIGN KEY (item_id)
    REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  CONSTRAINT stock_requests_from_location_id_fkey FOREIGN KEY (from_location_id)
    REFERENCES public.locations(id) ON DELETE CASCADE,
  CONSTRAINT stock_requests_to_location_id_fkey FOREIGN KEY (to_location_id)
    REFERENCES public.locations(id) ON DELETE CASCADE,
  CONSTRAINT stock_requests_requested_by_fkey FOREIGN KEY (requested_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT stock_requests_fulfilled_by_fkey FOREIGN KEY (fulfilled_by)
    REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS stock_requests_status_idx ON public.stock_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_requests_from_idx ON public.stock_requests(from_location_id);
CREATE INDEX IF NOT EXISTS stock_requests_to_idx ON public.stock_requests(to_location_id);

DROP TRIGGER IF EXISTS update_stock_requests_updated_at ON public.stock_requests;
CREATE TRIGGER update_stock_requests_updated_at
  BEFORE UPDATE ON public.stock_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Row level security is enabled here; the policies live in the ERP migration
-- (20260814_erp_integrity_core.sql) which keys them off profiles.role.
-- -----------------------------------------------------------------------------
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
