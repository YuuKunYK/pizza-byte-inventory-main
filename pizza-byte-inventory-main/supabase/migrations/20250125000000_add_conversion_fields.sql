-- Add new conversion fields to inventory_items table
-- This migration adds the manual conversion structure as requested

BEGIN;

-- Create enum for base units (standardized units)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'base_unit_type') THEN
        CREATE TYPE base_unit_type AS ENUM ('grams', 'kg', 'ml', 'liter', 'pcs');
    END IF;
END $$;

-- Add new columns to inventory_items table
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS base_unit base_unit_type,
ADD COLUMN IF NOT EXISTS purchase_unit TEXT,
ADD COLUMN IF NOT EXISTS purchase_conversion_value NUMERIC CHECK (purchase_conversion_value > 0),
ADD COLUMN IF NOT EXISTS manual_conversion_note TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.inventory_items.base_unit IS 'Standardized base unit (grams, kg, ml, liter, pcs)';
COMMENT ON COLUMN public.inventory_items.purchase_unit IS 'Purchase unit description (e.g., packet, box, can)';
COMMENT ON COLUMN public.inventory_items.purchase_conversion_value IS 'How many base units in one purchase unit (must be > 0)';
COMMENT ON COLUMN public.inventory_items.manual_conversion_note IS 'Optional clarification note for the conversion';

-- Create index for base_unit for better query performance
CREATE INDEX IF NOT EXISTS inventory_items_base_unit_idx ON public.inventory_items (base_unit);

COMMIT; 