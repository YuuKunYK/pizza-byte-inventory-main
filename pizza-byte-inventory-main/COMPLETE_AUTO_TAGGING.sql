-- COMPLETE AUTO-TAGGING SYSTEM FOR PIZZA RECIPES
-- This script will automatically tag existing recipes based on their names
-- Includes all pizza sizes, calzone sizes, types, and custom flavors

BEGIN;

-- ============================================================================
-- STEP 1: TAG PIZZA SIZES
-- ============================================================================
WITH pizza_size_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id,
    CASE 
      -- Most specific sizes get highest priority (lowest number = highest priority)
      WHEN LOWER(r.name) LIKE '%21 inch slice%' OR LOWER(r.name) LIKE '%21" slice%' OR LOWER(r.name) LIKE '%21-inch slice%' THEN 1
      WHEN LOWER(r.name) LIKE '%21 inch half%' OR LOWER(r.name) LIKE '%21" half%' OR LOWER(r.name) LIKE '%21-inch half%' THEN 2
      WHEN LOWER(r.name) LIKE '%21 inch%' OR LOWER(r.name) LIKE '%21"%' OR LOWER(r.name) LIKE '%21-inch%' THEN 3
      WHEN LOWER(r.name) LIKE '%16 inch half%' OR LOWER(r.name) LIKE '%16" half%' OR LOWER(r.name) LIKE '%16-inch half%' THEN 4
      WHEN LOWER(r.name) LIKE '%16 inch%' OR LOWER(r.name) LIKE '%16"%' OR LOWER(r.name) LIKE '%16-inch%' THEN 5
      WHEN LOWER(r.name) LIKE '%12 inch%' OR LOWER(r.name) LIKE '%12"%' OR LOWER(r.name) LIKE '%12-inch%' THEN 6
      WHEN LOWER(r.name) LIKE '%9 inch%' OR LOWER(r.name) LIKE '%9"%' OR LOWER(r.name) LIKE '%9-inch%' THEN 7
      WHEN LOWER(r.name) LIKE '%7 inch%' OR LOWER(r.name) LIKE '%7"%' OR LOWER(r.name) LIKE '%7-inch%' THEN 8
    END as priority
  FROM public.recipes r
  CROSS JOIN public.recipe_tags rt
  WHERE rt.category = 'size'
  AND rt.name IN ('7 inch', '9 inch', '12 inch', '16 inch', '16 inch Half', '21 inch', '21 inch Half', '21 inch Slice')
  AND (
    -- 21 inch Slice
    (rt.name = '21 inch Slice' AND (
      LOWER(r.name) LIKE '%21 inch slice%' OR LOWER(r.name) LIKE '%21" slice%' OR LOWER(r.name) LIKE '%21-inch slice%'
    )) OR
    -- 21 inch Half
    (rt.name = '21 inch Half' AND (
      LOWER(r.name) LIKE '%21 inch half%' OR LOWER(r.name) LIKE '%21" half%' OR LOWER(r.name) LIKE '%21-inch half%'
    )) OR
    -- 21 inch (full, but not half or slice)
    (rt.name = '21 inch' AND (
      (LOWER(r.name) LIKE '%21 inch%' OR LOWER(r.name) LIKE '%21"%' OR LOWER(r.name) LIKE '%21-inch%') 
      AND NOT (LOWER(r.name) LIKE '%half%' OR LOWER(r.name) LIKE '%slice%')
    )) OR
    -- 16 inch Half
    (rt.name = '16 inch Half' AND (
      LOWER(r.name) LIKE '%16 inch half%' OR LOWER(r.name) LIKE '%16" half%' OR LOWER(r.name) LIKE '%16-inch half%'
    )) OR
    -- 16 inch (full, but not half)
    (rt.name = '16 inch' AND (
      (LOWER(r.name) LIKE '%16 inch%' OR LOWER(r.name) LIKE '%16"%' OR LOWER(r.name) LIKE '%16-inch%') 
      AND NOT LOWER(r.name) LIKE '%half%'
    )) OR
    -- 12 inch
    (rt.name = '12 inch' AND (
      LOWER(r.name) LIKE '%12 inch%' OR LOWER(r.name) LIKE '%12"%' OR LOWER(r.name) LIKE '%12-inch%'
    )) OR
    -- 9 inch
    (rt.name = '9 inch' AND (
      LOWER(r.name) LIKE '%9 inch%' OR LOWER(r.name) LIKE '%9"%' OR LOWER(r.name) LIKE '%9-inch%'
    )) OR
    -- 7 inch
    (rt.name = '7 inch' AND (
      LOWER(r.name) LIKE '%7 inch%' OR LOWER(r.name) LIKE '%7"%' OR LOWER(r.name) LIKE '%7-inch%'
    ))
  )
),
pizza_size_ranked AS (
  SELECT recipe_id, tag_id,
    ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY priority) as rn
  FROM pizza_size_matches
)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT recipe_id, tag_id
FROM pizza_size_ranked
WHERE rn = 1
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- ============================================================================
-- STEP 2: TAG CALZONE SIZES
-- ============================================================================
WITH calzone_size_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id,
    CASE 
      -- Most specific calzone sizes get highest priority
      WHEN LOWER(r.name) LIKE '%mini calzone%' THEN 1
      WHEN LOWER(r.name) LIKE '%slice calzone%' OR LOWER(r.name) LIKE '%calzone slice%' THEN 2
      WHEN LOWER(r.name) LIKE '%half calzone%' OR LOWER(r.name) LIKE '%calzone half%' THEN 3
      WHEN LOWER(r.name) LIKE '%full calzone%' OR LOWER(r.name) LIKE '%calzone%' THEN 4
    END as priority
  FROM public.recipes r
  CROSS JOIN public.recipe_tags rt
  WHERE rt.category = 'size'
  AND rt.name IN ('Full Calzone', 'Half Calzone', 'Slice Calzone', 'Mini Calzone')
  AND (
    (rt.name = 'Mini Calzone' AND LOWER(r.name) LIKE '%mini calzone%') OR
    (rt.name = 'Slice Calzone' AND (LOWER(r.name) LIKE '%slice calzone%' OR LOWER(r.name) LIKE '%calzone slice%')) OR
    (rt.name = 'Half Calzone' AND (LOWER(r.name) LIKE '%half calzone%' OR LOWER(r.name) LIKE '%calzone half%')) OR
    (rt.name = 'Full Calzone' AND LOWER(r.name) LIKE '%calzone%' AND NOT (LOWER(r.name) LIKE '%half%' OR LOWER(r.name) LIKE '%slice%' OR LOWER(r.name) LIKE '%mini%'))
  )
),
calzone_size_ranked AS (
  SELECT recipe_id, tag_id,
    ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY priority) as rn
  FROM calzone_size_matches
)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT recipe_id, tag_id
FROM calzone_size_ranked
WHERE rn = 1
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- ============================================================================
-- STEP 3: TAG PIZZA TYPES (Standard/Thin Crust)
-- ============================================================================
WITH pizza_type_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id,
    CASE 
      -- Thin crust is more specific, gets higher priority
      WHEN LOWER(r.name) LIKE '%thin crust%' OR LOWER(r.name) LIKE '%thin-crust%' OR LOWER(r.name) LIKE '%thinecrust%' THEN 1
      -- Standard for any pizza/inch that's not calzone or thin crust
      WHEN (LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%inch%') AND NOT (LOWER(r.name) LIKE '%calzone%') THEN 2
    END as priority
  FROM public.recipes r
  CROSS JOIN public.recipe_tags rt
  WHERE rt.category = 'type'
  AND rt.name IN ('Standard', 'Thin Crust')
  AND (
    (rt.name = 'Thin Crust' AND (
      LOWER(r.name) LIKE '%thin crust%' OR LOWER(r.name) LIKE '%thin-crust%' OR LOWER(r.name) LIKE '%thinecrust%'
    )) OR
    (rt.name = 'Standard' AND (
      (LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%inch%') 
      AND NOT (LOWER(r.name) LIKE '%calzone%' OR LOWER(r.name) LIKE '%thin crust%' OR LOWER(r.name) LIKE '%thin-crust%' OR LOWER(r.name) LIKE '%thinecrust%')
    ))
  )
),
pizza_type_ranked AS (
  SELECT recipe_id, tag_id,
    ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY priority) as rn
  FROM pizza_type_matches
)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT recipe_id, tag_id
FROM pizza_type_ranked
WHERE rn = 1
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- ============================================================================
-- STEP 4: TAG CUSTOM FLAVORS
-- ============================================================================
WITH flavor_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id
  FROM public.recipes r
  CROSS JOIN public.recipe_tags rt
  WHERE rt.category = 'flavor'
  AND (
    -- Your Custom Pizza Flavors
    (rt.name = 'New York Special' AND (
      LOWER(r.name) LIKE '%new york%' OR LOWER(r.name) LIKE '%newyork%'
    )) OR
    (rt.name = 'Peri Peri Chicken' AND (
      LOWER(r.name) LIKE '%peri peri%' OR LOWER(r.name) LIKE '%periperi%' OR LOWER(r.name) LIKE '%peri-peri%'
    )) OR
    (rt.name = 'Houston Hot' AND (
      LOWER(r.name) LIKE '%houston%'
    )) OR
    (rt.name = 'Downtown Ranch' AND (
      LOWER(r.name) LIKE '%downtown%' OR LOWER(r.name) LIKE '%ranch%'
    )) OR
    (rt.name = 'Creamy Pleasure' AND (
      LOWER(r.name) LIKE '%creamy pleasure%' OR LOWER(r.name) LIKE '%creamypleasure%'
    )) OR
    (rt.name = 'Chicken Saucy BBQ' AND (
      LOWER(r.name) LIKE '%saucy bbq%' OR LOWER(r.name) LIKE '%bbq%' OR LOWER(r.name) LIKE '%barbecue%' OR LOWER(r.name) LIKE '%saucy%'
    )) OR
    (rt.name = 'Beef Pepperoni' AND (
      LOWER(r.name) LIKE '%beef pepperoni%' OR LOWER(r.name) LIKE '%beefpepperoni%'
    )) OR
    (rt.name = 'Chicken Pepperoni' AND (
      LOWER(r.name) LIKE '%chicken pepperoni%' OR LOWER(r.name) LIKE '%chickenpepperoni%'
    )) OR
    (rt.name = 'Chicken Tikka' AND (
      LOWER(r.name) LIKE '%tikka%'
    )) OR
    (rt.name = 'Chicken Fajita' AND (
      LOWER(r.name) LIKE '%fajita%'
    )) OR
    (rt.name = 'Creamy Ficato' AND (
      LOWER(r.name) LIKE '%ficato%' OR LOWER(r.name) LIKE '%creamy ficato%'
    )) OR
    (rt.name = 'Chicken Brooklyn' AND (
      LOWER(r.name) LIKE '%brooklyn%'
    )) OR
    (rt.name = 'Cheese Love' AND (
      LOWER(r.name) LIKE '%cheese love%' OR LOWER(r.name) LIKE '%cheeselove%' OR LOWER(r.name) LIKE '%cheese%'
    )) OR
    (rt.name = 'Veggie Love' AND (
      LOWER(r.name) LIKE '%veggie%' OR LOWER(r.name) LIKE '%vegetable%' OR LOWER(r.name) LIKE '%veg %'
    )) OR
    (rt.name = 'Chicken Euro' AND (
      LOWER(r.name) LIKE '%euro%' OR LOWER(r.name) LIKE '%european%'
    ))
  )
)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT recipe_id, tag_id
FROM flavor_matches
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- ============================================================================
-- VERIFICATION AND RESULTS
-- ============================================================================

-- Count assignments by category
SELECT 
  'Size Tags' as tag_type,
  COUNT(*) as assignments_count,
  STRING_AGG(DISTINCT rt.name, ', ' ORDER BY rt.name) as tag_names
FROM public.recipe_tag_assignments rta
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE rt.category = 'size'

UNION ALL

SELECT 
  'Type Tags' as tag_type,
  COUNT(*) as assignments_count,
  STRING_AGG(DISTINCT rt.name, ', ' ORDER BY rt.name) as tag_names
FROM public.recipe_tag_assignments rta
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE rt.category = 'type'

UNION ALL

SELECT 
  'Flavor Tags' as tag_type,
  COUNT(*) as assignments_count,
  STRING_AGG(DISTINCT rt.name, ', ' ORDER BY rt.name) as tag_names
FROM public.recipe_tag_assignments rta
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE rt.category = 'flavor';

-- Show detailed breakdown by tag
SELECT 
  rt.category,
  rt.name as tag_name,
  rt.color,
  COUNT(rta.recipe_id) as recipe_count
FROM public.recipe_tags rt
LEFT JOIN public.recipe_tag_assignments rta ON rt.id = rta.tag_id
WHERE rt.category IN ('size', 'type', 'flavor')
GROUP BY rt.category, rt.name, rt.color
ORDER BY rt.category, recipe_count DESC, rt.name;

-- Show sample tagged recipes (first 15)
SELECT 
  r.name as recipe_name,
  STRING_AGG(
    CASE rt.category 
      WHEN 'size' THEN '📏 ' || rt.name
      WHEN 'type' THEN '🍕 ' || rt.name  
      WHEN 'flavor' THEN '🌶️ ' || rt.name
    END, 
    ' | ' 
    ORDER BY rt.category, rt.name
  ) as tags
FROM public.recipes r
JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
GROUP BY r.id, r.name
ORDER BY r.name
LIMIT 15;

-- Check for untagged pizza/calzone recipes
SELECT 
  'Untagged Pizza/Calzone Recipes' as status,
  COUNT(*) as count
FROM public.recipes r
WHERE (
  LOWER(r.name) LIKE '%pizza%' OR 
  LOWER(r.name) LIKE '%calzone%' OR 
  LOWER(r.name) LIKE '%inch%'
)
AND NOT EXISTS (
  SELECT 1 FROM public.recipe_tag_assignments rta 
  WHERE rta.recipe_id = r.id
);

-- Show recipes that might need manual review
SELECT 
  r.name as recipe_name,
  CASE 
    WHEN LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%inch%' THEN 'Potential Pizza'
    WHEN LOWER(r.name) LIKE '%calzone%' THEN 'Potential Calzone'
    ELSE 'Other'
  END as detected_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.recipe_tag_assignments rta WHERE rta.recipe_id = r.id) 
    THEN 'Tagged' 
    ELSE 'Not Tagged' 
  END as tag_status
FROM public.recipes r
WHERE (
  LOWER(r.name) LIKE '%pizza%' OR 
  LOWER(r.name) LIKE '%calzone%' OR 
  LOWER(r.name) LIKE '%inch%'
)
ORDER BY tag_status, r.name
LIMIT 20;

COMMIT;

-- ============================================================================
-- SUMMARY
-- ============================================================================
/*
🎯 AUTO-TAGGING COMPLETE!

This script has automatically tagged your recipes with:

📏 SIZE TAGS:
   • Pizza: 7", 9", 12", 16", 16" Half, 21", 21" Half, 21" Slice
   • Calzone: Full, Half, Slice, Mini

🍕 TYPE TAGS:
   • Standard (default for pizzas)
   • Thin Crust (for thin crust variations)

🌶️ FLAVOR TAGS (Your Custom Flavors):
   • New York Special      • Peri Peri Chicken
   • Houston Hot           • Downtown Ranch
   • Creamy Pleasure       • Chicken Saucy BBQ
   • Beef Pepperoni        • Chicken Pepperoni
   • Chicken Tikka         • Chicken Fajita
   • Creamy Ficato         • Chicken Brooklyn
   • Cheese Love           • Veggie Love
   • Chicken Euro

🔍 MATCHING LOGIC:
   • Size: Exact matches with priority (most specific wins)
   • Type: Thin crust detection, default to Standard for pizzas
   • Flavor: Flexible keyword matching for your custom flavors
   • Conflict Resolution: Only one tag per category (size/type), multiple flavors allowed

✅ SAFE OPERATION:
   • Uses ON CONFLICT DO NOTHING to prevent duplicates
   • Transaction-wrapped for safety
   • Includes verification queries to check results

Run this script and your recipes will be automatically organized! 🍕✨
*/ 