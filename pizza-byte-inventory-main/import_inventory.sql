-- Import Inventory Items from InventoryRates.xlsx
-- This script will create categories if they don't exist and add/update inventory items

DO $$
BEGIN
    -- Ensure the uuid-ossp extension exists
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    
    -- Check if the unit_type enum exists, create it if not
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_type') THEN
        CREATE TYPE unit_type AS ENUM ('grams', 'kg', 'packet', 'quantity', 'liter', 'ml');
        RAISE NOTICE 'Created unit_type enum';
    END IF;
    
    -- Check if categories table exists, create it if not
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        CREATE TABLE categories (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created categories table';
    END IF;
    
    -- Check if inventory_items table exists, create it if not
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_items') THEN
        CREATE TABLE inventory_items (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL UNIQUE,
            category_id UUID REFERENCES categories(id),
            unit_type unit_type NOT NULL,
            cost_per_unit NUMERIC NOT NULL DEFAULT 0,
            min_stock_threshold INTEGER DEFAULT 1,
            conversion_value NUMERIC DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE 'Created inventory_items table';
    END IF;
END $$;

-- Create a function to map unit types from Excel to our enum values
CREATE OR REPLACE FUNCTION map_unit_type(unit_input TEXT) RETURNS TEXT AS $$
DECLARE
    unit_result TEXT;
BEGIN
    -- Default to quantity if null
    IF unit_input IS NULL OR unit_input = '' THEN
        RETURN 'quantity';
    END IF;
    
    -- Convert to lowercase for consistent matching
    unit_input := LOWER(TRIM(unit_input));
    
    -- Map various unit descriptions to standard types
    IF unit_input LIKE '%gram%' OR unit_input = 'g' OR unit_input = 'gm' THEN
        unit_result := 'grams';
    ELSIF unit_input LIKE '%kilo%' OR unit_input = 'kg' THEN
        unit_result := 'kg';
    ELSIF unit_input LIKE '%packet%' OR unit_input LIKE '%pack%' OR unit_input = 'pkt' THEN
        unit_result := 'packet';
    ELSIF unit_input LIKE '%qty%' OR unit_input LIKE '%quantity%' OR unit_input LIKE '%count%' 
          OR unit_input LIKE '%pcs%' OR unit_input LIKE '%piece%' OR unit_input = 'pc' THEN
        unit_result := 'quantity';
    ELSIF unit_input LIKE '%liter%' OR unit_input LIKE '%litre%' OR unit_input = 'l' OR unit_input = 'ltr' THEN
        unit_result := 'liter';
    ELSIF unit_input LIKE '%milli%' OR unit_input = 'ml' THEN
        unit_result := 'ml';
    ELSE
        -- Default to quantity for unknown units
        unit_result := 'quantity';
    END IF;
    
    RETURN unit_result;
END;
$$ LANGUAGE plpgsql;

-- Main function to process inventory items
DO $$
DECLARE
    category_id_var UUID;
    inventory_row RECORD;
    item_count INTEGER := 0;
    update_count INTEGER := 0;
    insert_count INTEGER := 0;
    skip_count INTEGER := 0;
BEGIN
    -- Ensure the 'Another' category exists
    INSERT INTO categories (name, created_at, updated_at)
    VALUES ('Another', NOW(), NOW())
    ON CONFLICT (name) DO NOTHING;
    
    -- -------------------------------------------------------------------------
    -- PASTE YOUR EXCEL DATA BELOW AS VALUES
    -- FORMAT: (Item Name, Category, Unit, Cost)
    
    -- -------------------------------------------------------------------------
    
    -- Process each inventory item
    FOR inventory_row IN (
        SELECT * FROM (
            VALUES
                ('Chicken Tikka', 'Meats', 'Pkt', 1300),
                ('Chicken Fajita', 'Meats', 'Pkt', 1300),
                ('Sausages', 'Meats', 'Pkt', 1089),
                ('Seekh Kabab', 'Meats', 'Pkt', 786),
                ('Chicken Pepperoni', 'Meats', 'Pkt', 337),
                ('Chicken Wings', 'Meats', 'Pkt', 852),
                ('Hot Tender', 'Meats', 'Pkt', 829),
                ('Chicken Strips', 'Side Lines', 'Pkt', 1071),
                ('Nuggets', 'Meats', 'Pkt', 895),
                ('Mirinato BT Regular', 'Other', 'Pkt', 1230),
                ('Beef Pepperoni', 'Meats', 'Pkt', 520),
                ('Fries', 'Side Lines', 'Pkt', 455),
                ('Curly Fires', 'Other', 'Pkt', 750),
                ('Farnan Cheese', 'Dairy', 'Pkt', 1140),
                ('French Bread Loaf', 'Other', 'Pc', 120),
                ('Burger Bun', 'Other', 'pc', 40),
                ('Black Olives', 'Vegetables', 'Tin', 2300),
                ('Jalapeno', 'Vegetables', 'Tin', 1470),
                ('Mushroom', 'Vegetables', 'Tin', 1750),
                ('Pizza Spice', 'Spices & Seasonings', 'Pkt', 46),
                ('Lasagne', 'Other', 'Pkt', 323.5),
                ('Elbow Pasta', 'Other', 'Pkt', 200),
                ('Crush Chili', 'Spices & Seasonings', 'Kg', 650),
                ('Fettuccine pasta', 'Other', 'Pkt', 650),
                ('Penny Pasta', 'Other', 'KG', 251),
                ('NYP Dough', 'Dough & Bases', 'Pkt', 120),
                ('Lava Cake', 'Dairy', 'Pc', 150),
                ('Mini Lava Cake', 'Dairy', 'Pc', 62),
                ('Oil', 'Other', 'Kg/Ltr', 400),
                ('Ketchup Sachet', 'Sauces', 'Pc', 2),
                ('Chili Garlic Sachet', 'Spices & Seasonings', 'Pc', 2),
                ('21" Box', 'Packaging', 'Pc', 59),
                ('21" Half Box', 'Packaging', 'Pc', 43),
                ('16" Box', 'Packaging', 'Pc', 46),
                ('9" Box', 'Packaging', 'Pc', 22.5),
                ('7" Box', 'Packaging', 'Pc', 17.5),
                ('Slice Box', 'Packaging', 'Pc', 23.5),
                ('D-Shape (New)', 'Other', 'Pc', 28),
                ('12" Box (New)', 'Packaging', 'Pc', 31),
                ('Zip Lock Small', 'Packaging', 'kg', 695),
                ('Zip Lock Large', 'Packaging', 'kg', 695),
                ('Bomb Box', 'Packaging', 'Pc', 11),
                ('F-1', 'Packaging', 'Pc', 9.5),
                ('F-2', 'Packaging', 'Pc', 20),
                ('P-3', 'Packaging', 'Pc', 22),
                ('Printed Butter Paper', 'Dairy', 'Pc', 3),
                ('Calzone Bag', 'Packaging', 'Pc', 10),
                ('Takeaway Bag', 'Packaging', 'Kg', 350),
                ('Dough Bag', 'Dough & Bases', 'Kg', 600),
                ('Box Supporter', 'Packaging', 'Pc', 1.7),
                ('Party Pack Tissue', 'Packaging', 'Pkt', 230),
                ('Remikin - Dip Container', 'Packaging', 'Pc', 1.9),
                ('Cling Film', 'Packaging', 'Roll', 850),
                ('MRD Sticker', 'Other', 'Pc', 0.75),
                ('Pepsi 1 Ltr.', 'Beverages', 'pc', 132),
                ('7-up 1 Ltr.', 'Beverages', 'pc', 132),
                ('Marinda 1 Ltr.', 'Beverages', 'pc', 132),
                ('Dew - 1 Ltr', 'Beverages', 'pc', 132),
                ('Pepsi-345 ML', 'Beverages', 'Pc', 68),
                ('7up-345 ML', 'Beverages', 'Pc', 68),
                ('Mirinda-345 ML', 'Other', 'Pc', 68),
                ('Dew-345 ML', 'Beverages', 'Pc', 68),
                ('Slice Juice', 'Beverages', 'Pc', 57),
                ('Sting 500 ml', 'Beverages', 'Pc', 107),
                ('Mineral Water - 1500 ML', 'Beverages', 'Pc', 84),
                ('Mineral Water - 500 ML', 'Beverages', 'Pc', 42),
                ('Water Next Cola 1500 ML', 'Beverages', 'Pc', 75),
                ('Water Next Cola 600 ML', 'Beverages', 'Pc', 42),
                ('Colanext 1 LTR', 'Beverages', 'pc', 118),
                ('Fizzup 1 LTR', 'Beverages', 'pc', 118),
                ('Rango 1 LTR', 'Beverages', 'pc', 118),
                ('Colanext 345ML', 'Beverages', 'Pc', 46),
                ('Fizzup 345ML', 'Beverages', 'Pc', 46),
                ('Rango 345ML', 'Beverages', 'Pc', 46),
                ('Capsicum', 'Vegetables', 'Pc', 200),
                ('Onion', 'Vegetables', 'Pc', 100),
                ('Printer Roll', 'Packaging', 'Pc', 140),
                ('Gloves', 'Other', 'Pkt', 50),
                ('Hair Net', 'Other', 'Pkt', 180),
                ('Mop Refill', 'Other', 'Pc', 200),
                ('Garbage Bag - Small', 'Packaging', 'Kg', 220),
                ('Garbage Bag - Large', 'Packaging', 'Kg', 220),
                ('Icing Sugar', 'Spices & Seasonings', 'kg', 190),
                ('Fries Bucket', 'Side Lines', 'Pc', 8),
                ('Fork', 'Other', 'Pc', 1.7),
                ('Knife', 'Other', 'Pc', 1.7),
                ('Spoon', 'Other', 'Pc', 1.7),
                ('Straw', 'Other', 'Pc', 0.52),
                ('Sauce Plate', 'Sauces', 'Pc', 1.2),
                ('Sip Glass', 'Other', 'Pc', 1.7),
                ('Fries Cup Small', 'Side Lines', 'Pc', 2.85),
                ('Fries Masala', 'Spices & Seasonings', 'Kg', 660),
                ('A4 paper', 'Other', 'Rim', 1000),
                ('Cofe Cup', 'Other', 'Pc', 3.5),
                ('Dood patti chai', 'Meats', 'Pkt', 1650),
                ('Coffee', 'Dough & Bases', 'Pkt', 1850),
                ('Food Safty Bag', 'Packaging', 'KG', 520),
                ('Ficato Sauce', 'Sauces', 'KG', 420),
                ('Garlic Mayo Sauce', 'Sauces', 'KG', 450),
                ('Creamy Pleasure Sauce', 'Dairy', 'KG', 780),
                ('Ranch Sauce', 'Sauces', 'KG', 450),
                ('Sriracha Sauce', 'Sauces', 'KG', 380),
                ('Smoky BBQ Sauce', 'Sauces', 'KG', 580),
                ('Garlic Mustard Sauce', 'Sauces', 'KG', 550),
                ('Peri Peri Sauce', 'Sauces', 'KG', 480),
                ('Cheese Sauce', 'Dairy', 'KG', 850),
                ('Pizza Sauce Red', 'Sauces', 'KG', 290),
                ('White Sauce', 'Sauces', 'KG', 690),
                ('Mustard sensation Sauce', 'Sauces', 'KG', 570),
                ('Firestrom Sauce', 'Sauces', 'KG', 450),
                ('Sweet Chilli Sauce', 'Sauces', 'KG', 440),
                ('Pan Dough', 'Dough & Bases', 'KG', 118),
                ('Garlic Butter Sauce', 'Dairy', 'kg', 1551),
                ('Pizza Spice Mix', 'Spices & Seasonings', 'Pkt', 135),
                ('Blue Band Margarine', 'Dairy', 'Pkt', 300),
                ('Cheese Powder', 'Dairy', 'Pkt', 1800),
                ('Tomato Paste', 'Vegetables', 'Tin', 392),
                ('NYP Dough Blend', 'Dough & Bases', 'Pkt', 75),
                ('Pan Dough Blend', 'Dough & Bases', '1 pkt', 176),
                ('Flour FF', 'Dough & Bases', 'Bag', 100),
                ('Black Papper', 'Other', 'Kg', 2400),
                ('Andyie''s Mayo', 'Sauces', 'Pkt', 438),
                ('Ketchup', 'Sauces', 'Bottle', 900),
                ('Chili Garlic', 'Spices & Seasonings', 'Bottle', 900),
                ('Buffalo Hot Sauce', 'Dough & Bases', 'Bottle', 2750),
                ('BBQ Sauce', 'Sauces', 'Bottle', 2850),
                ('Chipotle Sauce', 'Sauces', 'Bottle', 3500),
                ('Milk Pak Cream', 'Dairy', 'Pkt', 100),
                ('Milk Pak Milk', 'Dairy', 'Pkt', 90),
                ('Ranch Sauce Blend', 'Sauces', 'Pkt', 15),
                ('Siracha Sauce Blend', 'Sauces', 'pkt', 500),
                ('Vinegar', 'Other', 'Can', 750),
                ('Sugar', 'Spices & Seasonings', 'kg', 170),
                ('Soya Sauce', 'Sauces', 'Bottle', 885),
                ('Mustard seeds', 'Other', 'kg', 320),
                ('Soup Base Powder', 'Spices & Seasonings', 'Pkt', 60),
                ('Mustered Sauce', 'Sauces', 'Bottle', 1100),
                ('Fresh Garlic', 'Vegetables', 'Pc', 800),
                ('Lamon', 'Other', 'Pc', 300),
                ('Ice Burg', 'Other', 'KG', 600),
                ('Tomato', 'Vegetables', 'KG', 100),
                ('Peri peri Suce', 'Other', 'Pkt', 635),
                ('Peri Peri Instant Mix', 'Other', 'Pkt', 1200),
                ('Salt', 'Spices & Seasonings', 'Pkt', 50),
                ('Red Jalapeno', 'Vegetables', 'Tin', 2300),
                ('Trandoz Sweet Chilli Sauce 560ml', 'Sauces', 'Bottle', 530),
                ('Meat Sauce', 'Sauces', 'KG', 751.96),
                ('Onion Powder', 'Spices & Seasonings', 'Pkt', 0),
                ('Every Day Powder', 'Spices & Seasonings', 'Grame', 700),
                ('P-1', 'Packaging', 'Pc', 2.8),
                ('Chocolate', 'Sweets', 'Kg', 850),
                ('B. Powder', 'Spices & Seasonings', 'kg', 500),
                ('Origano', 'Spices & Seasonings', 'Pkt', 670),
                ('Yeast', 'Dough & Bases', 'Pkt', 950),
                ('Icecing Suger', 'Sweets', 'Pkt', 190),
                ('Megi mix', 'Spices & Seasonings', 'Pkt', 500),
                ('Coco Powder', 'Spices & Seasonings', 'Pkt', 310),
                ('Knowr Chicken Powder', 'Spices & Seasonings', 'Kg', 1700),
                ('Shan Salt', 'Spices & Seasonings', 'Pkt', 50),
                ('Sugar', 'Sweets', 'Kg', 170),
                ('Vanilla Essance', 'Sweets', 'Bottle', 70),
                ('Siracha Sauce', 'Sauces', 'Bottle', 422),
                ('Garlic Powder', 'Spices & Seasonings', 'Kg', 300),
                ('White Pepper', 'Spices & Seasonings', 'Kg', 2900),
                ('Basil', 'Spices & Seasonings', 'Pkt', 900),
                ('Rosemary', 'Spices & Seasonings', 'Pkt', 955),
                ('Thyme', 'Spices & Seasonings', 'Pkt', 955),
                ('Tarragon', 'Spices & Seasonings', 'Pkt', 4500),
                ('Eggs', 'Dairy', 'Pc', 20)
        ) AS t(item_name, category_name, unit_type, cost_per_unit)
    ) LOOP
        item_count := item_count + 1;
        
        -- Normalize values
        inventory_row.item_name := TRIM(inventory_row.item_name);
        inventory_row.category_name := COALESCE(TRIM(inventory_row.category_name), 'Another');
        
        -- Skip if item name is empty
        IF inventory_row.item_name = '' THEN
            skip_count := skip_count + 1;
            CONTINUE;
        END IF;
        
        -- Ensure cost is not negative
        IF inventory_row.cost_per_unit < 0 THEN
            inventory_row.cost_per_unit := 0;
        END IF;
        
        -- Get or create category
        SELECT id INTO category_id_var 
        FROM categories 
        WHERE LOWER(name) = LOWER(inventory_row.category_name) 
        LIMIT 1;
        
        IF category_id_var IS NULL THEN
            -- Create the category
            INSERT INTO categories (name, created_at, updated_at)
            VALUES (inventory_row.category_name, NOW(), NOW())
            RETURNING id INTO category_id_var;
            
            RAISE NOTICE 'Created new category: %', inventory_row.category_name;
        END IF;
        
        -- Check if the item already exists
        IF EXISTS (SELECT 1 FROM inventory_items WHERE LOWER(name) = LOWER(inventory_row.item_name)) THEN
            -- Update existing item
            UPDATE inventory_items
            SET 
                category_id = category_id_var,
                unit_type = map_unit_type(inventory_row.unit_type)::unit_type,
                cost_per_unit = inventory_row.cost_per_unit,
                updated_at = NOW()
            WHERE LOWER(name) = LOWER(inventory_row.item_name);
            
            update_count := update_count + 1;
            RAISE NOTICE 'Updated item: %', inventory_row.item_name;
        ELSE
            -- Insert new item
            INSERT INTO inventory_items (
                name, 
                category_id, 
                unit_type, 
                cost_per_unit, 
                min_stock_threshold, 
                conversion_value, 
                created_at, 
                updated_at
            )
            VALUES (
                inventory_row.item_name,
                category_id_var,
                map_unit_type(inventory_row.unit_type)::unit_type,
                inventory_row.cost_per_unit,
                10, -- default min_stock_threshold
                1,  -- default conversion_value
                NOW(),
                NOW()
            );
            
            insert_count := insert_count + 1;
            RAISE NOTICE 'Inserted new item: %', inventory_row.item_name;
        END IF;
    END LOOP;
    
    -- Report summary
    RAISE NOTICE 'Import completed successfully';
    RAISE NOTICE 'Items processed: %, Items inserted: %, Items updated: %, Items skipped: %', 
        item_count, insert_count, update_count, skip_count;
END $$;

-- Clean up the temporary function if no longer needed
-- DROP FUNCTION IF EXISTS map_unit_type(TEXT); 