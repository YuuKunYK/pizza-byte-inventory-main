-- Update POS System for Order Display Interface
-- Adds order status tracking and enhances pos_sales table

-- Add status column to pos_sales for order lifecycle tracking
ALTER TABLE pos_sales 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled'));

-- Add table_number for dine-in orders
ALTER TABLE pos_sales 
ADD COLUMN IF NOT EXISTS table_number TEXT;

-- Add customer_name for orders
ALTER TABLE pos_sales 
ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Add order_time separately for better tracking
ALTER TABLE pos_sales 
ADD COLUMN IF NOT EXISTS order_time TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add served_time for completion tracking
ALTER TABLE pos_sales 
ADD COLUMN IF NOT EXISTS served_time TIMESTAMP WITH TIME ZONE;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_pos_sales_status ON pos_sales(status);

-- Create index on order_type and status combined
CREATE INDEX IF NOT EXISTS idx_pos_sales_type_status ON pos_sales(order_type, status);

-- Create index on branch_id and status
CREATE INDEX IF NOT EXISTS idx_pos_sales_branch_status ON pos_sales(branch_id, status);

-- Function to auto-set order_time
CREATE OR REPLACE FUNCTION set_order_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_time IS NULL THEN
        NEW.order_time = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set order_time
DROP TRIGGER IF EXISTS set_order_time_trigger ON pos_sales;
CREATE TRIGGER set_order_time_trigger
    BEFORE INSERT ON pos_sales
    FOR EACH ROW
    EXECUTE FUNCTION set_order_time();

-- Function to update served_time when status changes to served/completed
CREATE OR REPLACE FUNCTION update_served_time()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('served', 'completed') AND OLD.status NOT IN ('served', 'completed') THEN
        NEW.served_time = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update served_time
DROP TRIGGER IF EXISTS update_served_time_trigger ON pos_sales;
CREATE TRIGGER update_served_time_trigger
    BEFORE UPDATE ON pos_sales
    FOR EACH ROW
    EXECUTE FUNCTION update_served_time();

-- Update RLS policies to include new status filtering
DROP POLICY IF EXISTS "Admin can view all sales" ON pos_sales;
CREATE POLICY "Admin can view all sales"
    ON pos_sales FOR SELECT
    USING (auth.jwt()->>'role' = 'admin');

DROP POLICY IF EXISTS "Branch can view their own sales" ON pos_sales;
CREATE POLICY "Branch can view their own sales"
    ON pos_sales FOR SELECT
    USING (
        auth.jwt()->>'role' = 'branch' AND
        branch_id::TEXT = auth.jwt()->>'location_id'
    );

-- Update insert policy to allow setting status
DROP POLICY IF EXISTS "Admin and Branch can insert sales" ON pos_sales;
CREATE POLICY "Admin and Branch can insert sales"
    ON pos_sales FOR INSERT
    WITH CHECK (
        auth.jwt()->>'role' IN ('admin', 'branch')
    );

-- Allow updates to status and other fields
DROP POLICY IF EXISTS "Admin can update sales" ON pos_sales;
CREATE POLICY "Admin can update sales"
    ON pos_sales FOR UPDATE
    USING (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Branch can update their own sales"
    ON pos_sales FOR UPDATE
    USING (
        auth.jwt()->>'role' = 'branch' AND
        branch_id::TEXT = auth.jwt()->>'location_id'
    );

-- Grant permissions
GRANT ALL ON pos_sales TO authenticated;

COMMENT ON COLUMN pos_sales.status IS 'Order status: pending (new), preparing (kitchen), ready (done), served (to customer), completed (paid), cancelled';
COMMENT ON COLUMN pos_sales.table_number IS 'Table number for dine-in orders';
COMMENT ON COLUMN pos_sales.customer_name IS 'Customer name for the order';
COMMENT ON COLUMN pos_sales.order_time IS 'Time when order was placed';
COMMENT ON COLUMN pos_sales.served_time IS 'Time when order was marked as served/completed';

