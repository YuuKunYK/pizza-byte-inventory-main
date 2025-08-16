-- Create dough configuration tables
-- This will store pizza and calzone dough amounts that can be configured in the UI

BEGIN;

-- Create pizza dough configuration table
CREATE TABLE IF NOT EXISTS public.pizza_dough_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size_id TEXT NOT NULL UNIQUE, -- '7inch', '9inch', '12inch', etc.
    size_name TEXT NOT NULL, -- '7 inch', '9 inch', '12 inch', etc.
    standard_dough INTEGER NOT NULL CHECK (standard_dough > 0), -- Standard pizza dough in grams
    thin_crust_dough INTEGER NOT NULL CHECK (thin_crust_dough > 0), -- Thin crust pizza dough in grams
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create calzone dough configuration table
CREATE TABLE IF NOT EXISTS public.calzone_dough_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    size_id TEXT NOT NULL UNIQUE, -- 'full', 'half', 'slice', 'mini'
    size_name TEXT NOT NULL, -- 'Full', 'Half', 'Slice', 'Mini'
    dough_amount INTEGER NOT NULL CHECK (dough_amount > 0), -- Calzone dough in grams
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default pizza dough values with corrected standard AND thin crust amounts
INSERT INTO public.pizza_dough_config (size_id, size_name, standard_dough, thin_crust_dough) VALUES
('7inch', '7 inch', 150, 70),
('9inch', '9 inch', 250, 150),
('12inch', '12 inch', 450, 250),
('16inch', '16 inch', 700, 400),
('16inch_half', '16 inch Half', 400, 250),
('21inch', '21 inch', 1050, 750),
('21inch_half', '21 inch Half', 500, 390),
('21inch_slice', '21 inch Slice', 225, 150)
ON CONFLICT (size_id) DO UPDATE SET
    size_name = EXCLUDED.size_name,
    standard_dough = EXCLUDED.standard_dough,
    thin_crust_dough = EXCLUDED.thin_crust_dough,
    updated_at = now();

-- Insert default calzone dough values with corrected amounts
INSERT INTO public.calzone_dough_config (size_id, size_name, dough_amount) VALUES
('full', 'Full', 1000),
('half', 'Half', 500),
('slice', 'Slice', 150),
('mini', 'Mini', 70)
ON CONFLICT (size_id) DO UPDATE SET
    size_name = EXCLUDED.size_name,
    dough_amount = EXCLUDED.dough_amount,
    updated_at = now();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS pizza_dough_config_size_id_idx ON public.pizza_dough_config (size_id);
CREATE INDEX IF NOT EXISTS calzone_dough_config_size_id_idx ON public.calzone_dough_config (size_id);

-- Enable row level security
ALTER TABLE public.pizza_dough_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calzone_dough_config ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "View pizza dough config" ON public.pizza_dough_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Update pizza dough config" ON public.pizza_dough_config
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "View calzone dough config" ON public.calzone_dough_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Update calzone dough config" ON public.calzone_dough_config
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Add comments for documentation
COMMENT ON TABLE public.pizza_dough_config IS 'Stores configurable dough amounts for different pizza sizes and types';
COMMENT ON TABLE public.calzone_dough_config IS 'Stores configurable dough amounts for different calzone sizes';

COMMIT;
