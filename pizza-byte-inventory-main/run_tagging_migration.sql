-- Run this script to set up the recipe tagging system
-- Execute in your Supabase SQL editor or via command line

-- Step 1: Create the tagging system
\i supabase/migrations/20250127_create_recipe_tags.sql

-- Step 2: Verify the system is created correctly
SELECT 'Recipe Tags Created:' as message, count(*) as tag_count FROM public.recipe_tags;
SELECT 'Available Pizza Size Tags:' as message, name FROM public.recipe_tags WHERE category = 'size' AND name NOT LIKE '%Calzone%' ORDER BY name;
SELECT 'Available Calzone Size Tags:' as message, name FROM public.recipe_tags WHERE category = 'size' AND name LIKE '%Calzone%' ORDER BY name;
SELECT 'Available Type Tags:' as message, name FROM public.recipe_tags WHERE category = 'type' ORDER BY name;

-- Step 3: Show existing recipes that could be tagged
SELECT 'Potential Pizza Recipes:' as message, count(*) as recipe_count 
FROM public.recipes 
WHERE LOWER(name) LIKE '%pizza%' 
   OR LOWER(name) LIKE '%margherita%'
   OR LOWER(name) LIKE '%pepperoni%'
   OR LOWER(name) LIKE '%supreme%'
   OR LOWER(name) LIKE '%hawaiian%';

SELECT 'Potential Calzone Recipes:' as message, count(*) as recipe_count 
FROM public.recipes 
WHERE LOWER(name) LIKE '%calzone%';

-- Step 4: Ready for ChatGPT tagging
SELECT '=== SYSTEM READY FOR CHATGPT TAGGING ===' as status;
SELECT 'Next step: Use the ChatGPT prompt to generate tagging SQL' as instruction; 