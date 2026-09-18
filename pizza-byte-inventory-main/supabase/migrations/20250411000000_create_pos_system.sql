-- POS System Migration
-- Creates tables for Point of Sale functionality including categories, items, discounts, and sales

-- 1. Create pos_categories table (hierarchical category system)
CREATE TABLE IF NOT EXISTS pos_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    parent_category_id UUID REFERENCES pos_categories(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    icon TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create pos_items table (sale items with recipe linkage)
CREATE TABLE IF NOT EXISTS pos_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES pos_categories(id) ON DELETE SET NULL,
    subcategory_id UUID REFERENCES pos_categories(id) ON DELETE SET NULL,
    price INTEGER NOT NULL CHECK (price >= 0), -- in paisa (PKR cents)
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    cost_per_item INTEGER DEFAULT 0 CHECK (cost_per_item >= 0), -- auto-calculated from recipe
    available BOOLEAN DEFAULT TRUE,
    image_url TEXT,
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create discount_rules table (predefined discounts)
CREATE TABLE IF NOT EXISTS discount_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value NUMERIC NOT NULL CHECK (value >= 0),
    conditions JSONB DEFAULT '{}',
    active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create pos_sales table (complete sales records)
CREATE TABLE IF NOT EXISTS pos_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]', -- array of {item_id, name, quantity, price, cost}
    subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
    discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed', 'none')),
    discount_value NUMERIC DEFAULT 0,
    discount_amount INTEGER DEFAULT 0,
    tax INTEGER DEFAULT 0,
    total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
    profit INTEGER DEFAULT 0, -- calculated: total - sum(item_costs)
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'wallet')),
    order_type TEXT NOT NULL CHECK (order_type IN ('dining', 'takeaway', 'delivery')),
    branch_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_pos_categories_parent ON pos_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_category ON pos_items(category_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_subcategory ON pos_items(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_recipe ON pos_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_branch ON pos_sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_pos_sales_order_number ON pos_sales(order_number);
CREATE INDEX IF NOT EXISTS idx_pos_sales_created_at ON pos_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_cashier ON pos_sales(cashier_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_pos_categories_updated_at BEFORE UPDATE ON pos_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pos_items_updated_at BEFORE UPDATE ON pos_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_discount_rules_updated_at BEFORE UPDATE ON discount_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pos_sales_updated_at BEFORE UPDATE ON pos_sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-calculate cost_per_item from recipe
CREATE OR REPLACE FUNCTION calculate_pos_item_cost()
RETURNS TRIGGER AS $$
DECLARE
    total_cost INTEGER;
BEGIN
    -- If recipe_id is set, calculate cost from recipe ingredients
    IF NEW.recipe_id IS NOT NULL THEN
        SELECT COALESCE(SUM(
            CAST(ri.quantity * ii.cost_per_unit AS INTEGER)
        ), 0)
        INTO total_cost
        FROM recipe_items ri
        JOIN inventory_items ii ON ri.item_id = ii.id
        WHERE ri.recipe_id = NEW.recipe_id;
        
        NEW.cost_per_item = total_cost;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate cost when recipe is linked
CREATE TRIGGER calculate_cost_on_recipe_link
    BEFORE INSERT OR UPDATE OF recipe_id ON pos_items
    FOR EACH ROW
    WHEN (NEW.recipe_id IS NOT NULL)
    EXECUTE FUNCTION calculate_pos_item_cost();

-- Function to deduct inventory after a sale
CREATE OR REPLACE FUNCTION deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    sale_item JSONB;
    recipe_ingredient RECORD;
BEGIN
    -- Loop through each item in the sale
    FOR sale_item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
        -- Get the pos_item to find its recipe
        IF (sale_item->>'item_id') IS NOT NULL THEN
            -- Loop through recipe ingredients and deduct from stock
            FOR recipe_ingredient IN
                SELECT ri.item_id, ri.quantity, pi.recipe_id
                FROM pos_items pi
                JOIN recipe_items ri ON ri.recipe_id = pi.recipe_id
                WHERE pi.id = (sale_item->>'item_id')::UUID
                  AND pi.recipe_id IS NOT NULL
            LOOP
                -- Deduct from inventory_items current_stock
                UPDATE inventory_items
                SET current_stock = current_stock - (recipe_ingredient.quantity * (sale_item->>'quantity')::INTEGER)
                WHERE id = recipe_ingredient.item_id
                  AND current_stock >= (recipe_ingredient.quantity * (sale_item->>'quantity')::INTEGER);
                
                -- Note: We're updating current_stock directly
                -- In production, you might want to create stock_entries records
            END LOOP;
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to deduct inventory after sale is created
CREATE TRIGGER deduct_inventory_after_sale
    AFTER INSERT ON pos_sales
    FOR EACH ROW
    EXECUTE FUNCTION deduct_inventory_on_sale();

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    sequence_num INTEGER;
    order_num TEXT;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Get the next sequence number for today
    SELECT COUNT(*) + 1 INTO sequence_num
    FROM pos_sales
    WHERE order_number LIKE 'ORD-' || date_part || '-%';
    
    order_num := 'ORD-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number = generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number_on_insert
    BEFORE INSERT ON pos_sales
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE pos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;

-- pos_categories policies
CREATE POLICY "Everyone can view categories"
    ON pos_categories FOR SELECT
    USING (true);

CREATE POLICY "Admin can insert categories"
    ON pos_categories FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can update categories"
    ON pos_categories FOR UPDATE
    USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can delete categories"
    ON pos_categories FOR DELETE
    USING (auth.jwt()->>'role' = 'admin');

-- pos_items policies
CREATE POLICY "Everyone can view available items"
    ON pos_items FOR SELECT
    USING (available = true OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can insert items"
    ON pos_items FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can update items"
    ON pos_items FOR UPDATE
    USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can delete items"
    ON pos_items FOR DELETE
    USING (auth.jwt()->>'role' = 'admin');

-- discount_rules policies
CREATE POLICY "Everyone can view active discounts"
    ON discount_rules FOR SELECT
    USING (active = true OR auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can insert discounts"
    ON discount_rules FOR INSERT
    WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can update discounts"
    ON discount_rules FOR UPDATE
    USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can delete discounts"
    ON discount_rules FOR DELETE
    USING (auth.jwt()->>'role' = 'admin');

-- pos_sales policies
CREATE POLICY "Admin can view all sales"
    ON pos_sales FOR SELECT
    USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Branch can view their own sales"
    ON pos_sales FOR SELECT
    USING (
        auth.jwt()->>'role' = 'branch' AND
        branch_id::TEXT = auth.jwt()->>'location_id'
    );

CREATE POLICY "Admin and Branch can insert sales"
    ON pos_sales FOR INSERT
    WITH CHECK (
        auth.jwt()->>'role' IN ('admin', 'branch')
    );

CREATE POLICY "Admin can update sales"
    ON pos_sales FOR UPDATE
    USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Admin can delete sales"
    ON pos_sales FOR DELETE
    USING (auth.jwt()->>'role' = 'admin');

-- Grant necessary permissions
GRANT ALL ON pos_categories TO authenticated;
GRANT ALL ON pos_items TO authenticated;
GRANT ALL ON discount_rules TO authenticated;
GRANT ALL ON pos_sales TO authenticated;

