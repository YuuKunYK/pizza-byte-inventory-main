-- ===================================================================
-- RECIPE BULK IMPORT TEMPLATE FOR PIZZA BYTE INVENTORY SYSTEM
-- ===================================================================
-- 
-- INSTRUCTIONS FOR CHATGPT:
-- 1. Replace the sample data with actual Excel data provided by user
-- 2. Generate UUIDs for each recipe and recipe_item (use gen_random_uuid())  
-- 3. Match ingredient names to existing inventory_items by name
-- 4. Follow the exact structure and format shown below
-- 5. Include proper error handling and validation
-- 6. Add timestamps for created_at and updated_at fields
--
-- DATABASE SCHEMA REFERENCE:
-- recipes table: id (UUID), name (TEXT), description (TEXT), created_at, updated_at
-- recipe_items table: id (UUID), recipe_id (UUID), item_id (UUID), quantity (NUMERIC), created_at, updated_at
-- inventory_items table: id (UUID), name (TEXT), cost_per_unit (NUMERIC), unit_type (ENUM)
-- ===================================================================

-- STEP 1: Create a temporary table to store recipe data
CREATE TEMP TABLE temp_recipe_import (
    recipe_name TEXT NOT NULL,
    recipe_description TEXT,
    ingredient_name TEXT NOT NULL,
    ingredient_quantity NUMERIC NOT NULL,
    ingredient_unit TEXT,
    row_number SERIAL
);

-- STEP 2: Insert sample data (REPLACE THIS SECTION WITH ACTUAL EXCEL DATA)
-- FORMAT: INSERT INTO temp_recipe_import (recipe_name, recipe_description, ingredient_name, ingredient_quantity, ingredient_unit) VALUES
-- ('Recipe Name', 'Recipe Description', 'Ingredient Name', Quantity, 'Unit');

INSERT INTO temp_recipe_import (recipe_name, recipe_description, ingredient_name, ingredient_quantity, ingredient_unit) VALUES
-- SAMPLE DATA - REPLACE WITH ACTUAL DATA FROM EXCEL
('12 inch Margherita Pizza', 'Classic margherita pizza with fresh mozzarella and basil', 'Pizza Dough', 300, 'grams'),
('12 inch Margherita Pizza', 'Classic margherita pizza with fresh mozzarella and basil', 'Tomato Sauce', 80, 'ml'),
('12 inch Margherita Pizza', 'Classic margherita pizza with fresh mozzarella and basil', 'Mozzarella Cheese', 150, 'grams'),
('12 inch Margherita Pizza', 'Classic margherita pizza with fresh mozzarella and basil', 'Fresh Basil', 10, 'grams'),

('Full Calzone', 'Traditional Italian calzone filled with ricotta and mozzarella', 'Pizza Dough', 350, 'grams'),
('Full Calzone', 'Traditional Italian calzone filled with ricotta and mozzarella', 'Ricotta Cheese', 200, 'grams'),
('Full Calzone', 'Traditional Italian calzone filled with ricotta and mozzarella', 'Mozzarella Cheese', 100, 'grams'),
('Full Calzone', 'Traditional Italian calzone filled with ricotta and mozzarella', 'Tomato Sauce', 60, 'ml'),

('Chicken Wings', 'Spicy buffalo chicken wings with ranch dip', 'Chicken Wings', 500, 'grams'),
('Chicken Wings', 'Spicy buffalo chicken wings with ranch dip', 'Buffalo Sauce', 50, 'ml'),
('Chicken Wings', 'Spicy buffalo chicken wings with ranch dip', 'Ranch Dressing', 30, 'ml');

-- STEP 3: Validate ingredient names against existing inventory
-- This will show any ingredients that don't exist in inventory_items
SELECT DISTINCT 
    tri.ingredient_name,
    'MISSING FROM INVENTORY' as status
FROM temp_recipe_import tri
LEFT JOIN public.inventory_items ii ON LOWER(TRIM(ii.name)) = LOWER(TRIM(tri.ingredient_name))
WHERE ii.id IS NULL
ORDER BY tri.ingredient_name;

-- STEP 4: Insert recipes (only unique recipe names)
INSERT INTO public.recipes (id, name, description, created_at, updated_at)
SELECT 
    gen_random_uuid() as id,
    recipe_name,
    recipe_description,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM (
    SELECT DISTINCT 
        recipe_name,
        COALESCE(recipe_description, '') as recipe_description
    FROM temp_recipe_import
) unique_recipes
WHERE NOT EXISTS (
    SELECT 1 FROM public.recipes r 
    WHERE LOWER(TRIM(r.name)) = LOWER(TRIM(unique_recipes.recipe_name))
);

-- STEP 5: Insert recipe items with proper ingredient matching
INSERT INTO public.recipe_items (id, recipe_id, item_id, quantity, created_at, updated_at)
SELECT 
    gen_random_uuid() as id,
    r.id as recipe_id,
    ii.id as item_id,
    tri.ingredient_quantity as quantity,
    CURRENT_TIMESTAMP as created_at,
    CURRENT_TIMESTAMP as updated_at
FROM temp_recipe_import tri
INNER JOIN public.recipes r ON LOWER(TRIM(r.name)) = LOWER(TRIM(tri.recipe_name))
INNER JOIN public.inventory_items ii ON LOWER(TRIM(ii.name)) = LOWER(TRIM(tri.ingredient_name))
WHERE tri.ingredient_quantity > 0;

-- STEP 6: Verification queries to check imported data
-- Show imported recipes count
SELECT 'RECIPES IMPORTED' as info, COUNT(*) as count
FROM public.recipes r
WHERE r.created_at >= CURRENT_DATE;

-- Show imported recipe items count  
SELECT 'RECIPE ITEMS IMPORTED' as info, COUNT(*) as count
FROM public.recipe_items ri
WHERE ri.created_at >= CURRENT_DATE;

-- Show detailed import results
SELECT 
    r.name as recipe_name,
    r.description,
    COUNT(ri.id) as ingredient_count,
    ROUND(SUM(ii.cost_per_unit * ri.quantity), 2) as estimated_cost
FROM public.recipes r
LEFT JOIN public.recipe_items ri ON r.id = ri.recipe_id
LEFT JOIN public.inventory_items ii ON ri.item_id = ii.id
WHERE r.created_at >= CURRENT_DATE
GROUP BY r.id, r.name, r.description
ORDER BY r.name;

-- STEP 7: Clean up temporary table
DROP TABLE temp_recipe_import;

-- ===================================================================
-- GUIDELINES FOR CHATGPT WHEN GENERATING THE ACTUAL IMPORT:
-- ===================================================================
--
-- 1. EXCEL DATA FORMAT EXPECTED:
--    Column A: Recipe Name
--    Column B: Recipe Description (optional)
--    Column C: Ingredient Name
--    Column D: Ingredient Quantity
--    Column E: Ingredient Unit (optional)
--
-- 2. DATA PROCESSING RULES:
--    - Each row in Excel represents one ingredient for one recipe
--    - Multiple rows with same recipe name = multiple ingredients for that recipe
--    - Recipe names must be unique across the database
--    - Ingredient names must match existing inventory items exactly (case-insensitive)
--    - Quantities must be positive numbers
--    - Empty descriptions should be replaced with empty string ''
--
-- 3. VALIDATION REQUIREMENTS:
--    - Check all ingredient names exist in inventory_items table
--    - Verify no duplicate recipe names in import data
--    - Ensure all quantities are positive numbers
--    - Handle special characters and spaces in names
--
-- 4. ERROR HANDLING:
--    - If ingredient doesn't exist, show clear error message
--    - If recipe already exists, skip it (don't duplicate)
--    - If quantity is 0 or negative, skip that ingredient
--    - Provide detailed import summary at the end
--
-- 5. UUID GENERATION:
--    - Always use gen_random_uuid() for new IDs
--    - Never use hardcoded UUIDs
--    - Each recipe and recipe_item needs unique UUID
--
-- 6. NAMING CONVENTIONS:
--    - Recipe names should follow format: "Size Type ItemName" 
--    - Examples: "12 inch Margherita Pizza", "Full Calzone", "Chicken Wings"
--    - Use proper capitalization
--    - Be consistent with pizza/calzone naming
--
-- 7. QUANTITIES AND UNITS:
--    - Always include quantities in the base unit (grams, ml, pieces)
--    - Convert from other units if needed (kg to grams, liters to ml)
--    - Pizza dough: typically 150-650 grams depending on size
--    - Calzone dough: typically 120-350 grams depending on size
--
-- 8. SPECIAL HANDLING FOR PIZZA RECIPES:
--    - Include pizza size in recipe name (7 inch, 9 inch, 12 inch, etc.)
--    - Include pizza type if specified (Standard, Thin Crust)
--    - Dough amounts should match the configured amounts in system
--    - Include standard pizza ingredients: dough, sauce, cheese, toppings
--
-- 9. DATA VERIFICATION:
--    - Always run the verification queries at the end
--    - Show import summary with counts and any errors
--    - List any missing ingredients that need to be added to inventory first
--
-- 10. PERFORMANCE CONSIDERATIONS:
--     - Use batch inserts where possible
--     - Include proper WHERE NOT EXISTS clauses to avoid duplicates
--     - Use LOWER(TRIM()) for string matching to handle spaces/case
--
-- ===================================================================
-- EXAMPLE USAGE:
-- ===================================================================
-- 1. User provides Excel data to ChatGPT
-- 2. ChatGPT converts Excel data to INSERT statements in temp_recipe_import
-- 3. ChatGPT replaces the sample data section with actual data
-- 4. User runs the complete SQL script in their database
-- 5. Script validates, imports, and provides detailed results
-- =================================================================== 