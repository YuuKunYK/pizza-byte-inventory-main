-- Auto-tag existing recipes based on recipe names
-- This script will analyze recipe names and assign appropriate size, type, and flavor tags

BEGIN;

-- Step 1: Tag pizza sizes
WITH pizza_size_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id,
    CASE 
      WHEN LOWER(r.name) LIKE '%21 inch slice%' OR LOWER(r.name) LIKE '%21" slice%' THEN 1
      WHEN LOWER(r.name) LIKE '%21 inch half%' OR LOWER(r.name) LIKE '%21" half%' THEN 2
      WHEN LOWER(r.name) LIKE '%21 inch%' OR LOWER(r.name) LIKE '%21"%' THEN 3
      WHEN LOWER(r.name) LIKE '%16 inch half%' OR LOWER(r.name) LIKE '%16" half%' THEN 4
      WHEN LOWER(r.name) LIKE '%16 inch%' OR LOWER(r.name) LIKE '%16"%' THEN 5
      WHEN LOWER(r.name) LIKE '%12 inch%' OR LOWER(r.name) LIKE '%12"%' THEN 6
      WHEN LOWER(r.name) LIKE '%9 inch%' OR LOWER(r.name) LIKE '%9"%' THEN 7
      WHEN LOWER(r.name) LIKE '%7 inch%' OR LOWER(r.name) LIKE '%7"%' THEN 8
    END as priority
  FROM public.recipes r
  CROSS JOIN public.recipe_tags rt
  WHERE rt.category = 'size'
  AND rt.name IN ('7 inch', '9 inch', '12 inch', '16 inch', '16 inch Half', '21 inch', '21 inch Half', '21 inch Slice')
  AND (
    (rt.name = '21 inch Slice' AND (LOWER(r.name) LIKE '%21 inch slice%' OR LOWER(r.name) LIKE '%21" slice%')) OR
    (rt.name = '21 inch Half' AND (LOWER(r.name) LIKE '%21 inch half%' OR LOWER(r.name) LIKE '%21" half%')) OR
    (rt.name = '21 inch' AND (LOWER(r.name) LIKE '%21 inch%' OR LOWER(r.name) LIKE '%21"%') AND NOT (LOWER(r.name) LIKE '%half%' OR LOWER(r.name) LIKE '%slice%')) OR
    (rt.name = '16 inch Half' AND (LOWER(r.name) LIKE '%16 inch half%' OR LOWER(r.name) LIKE '%16" half%')) OR
    (rt.name = '16 inch' AND (LOWER(r.name) LIKE '%16 inch%' OR LOWER(r.name) LIKE '%16"%') AND NOT LOWER(r.name) LIKE '%half%') OR
    (rt.name = '12 inch' AND (LOWER(r.name) LIKE '%12 inch%' OR LOWER(r.name) LIKE '%12"%')) OR
    (rt.name = '9 inch' AND (LOWER(r.name) LIKE '%9 inch%' OR LOWER(r.name) LIKE '%9"%')) OR
    (rt.name = '7 inch' AND (LOWER(r.name) LIKE '%7 inch%' OR LOWER(r.name) LIKE '%7"%'))
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

-- Step 2: Tag calzone sizes
WITH calzone_size_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id,
    CASE 
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

-- Step 3: Tag pizza types (Standard/Thin Crust)
WITH pizza_type_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id,
    CASE 
      WHEN LOWER(r.name) LIKE '%thin crust%' OR LOWER(r.name) LIKE '%thin-crust%' THEN 1
      WHEN (LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%inch%') AND NOT (LOWER(r.name) LIKE '%calzone%') THEN 2
    END as priority
  FROM public.recipes r
  CROSS JOIN public.recipe_tags rt
  WHERE rt.category = 'type'
  AND rt.name IN ('Standard', 'Thin Crust')
  AND (
    (rt.name = 'Thin Crust' AND (LOWER(r.name) LIKE '%thin crust%' OR LOWER(r.name) LIKE '%thin-crust%')) OR
    (rt.name = 'Standard' AND (LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%inch%') AND NOT (LOWER(r.name) LIKE '%calzone%' OR LOWER(r.name) LIKE '%thin crust%' OR LOWER(r.name) LIKE '%thin-crust%'))
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

-- Step 4: Tag flavors based on recipe names
WITH flavor_matches AS (
  SELECT DISTINCT 
    r.id as recipe_id,
    rt.id as tag_id
  FROM public.recipes r
  CROSS JOIN public.recipe_tags rt
  WHERE rt.category = 'flavor'
  AND (
    (rt.name = 'New York Special' AND LOWER(r.name) LIKE '%new york%') OR
    (rt.name = 'Peri Peri Chicken' AND LOWER(r.name) LIKE '%peri peri%') OR
    (rt.name = 'Houston Hot' AND LOWER(r.name) LIKE '%houston%') OR
    (rt.name = 'Downtown Ranch' AND LOWER(r.name) LIKE '%ranch%') OR
    (rt.name = 'Creamy Pleasure' AND LOWER(r.name) LIKE '%creamy pleasure%') OR
    (rt.name = 'Chicken Saucy BBQ' AND (LOWER(r.name) LIKE '%bbq%' OR LOWER(r.name) LIKE '%barbecue%')) OR
    (rt.name = 'Beef Pepperoni' AND LOWER(r.name) LIKE '%beef pepperoni%') OR
    (rt.name = 'Chicken Pepperoni' AND LOWER(r.name) LIKE '%chicken pepperoni%') OR
    (rt.name = 'Chicken Tikka' AND LOWER(r.name) LIKE '%tikka%') OR
    (rt.name = 'Chicken Fajita' AND LOWER(r.name) LIKE '%fajita%') OR
    (rt.name = 'Creamy Ficato' AND LOWER(r.name) LIKE '%ficato%') OR
    (rt.name = 'Chicken Brooklyn' AND LOWER(r.name) LIKE '%brooklyn%') OR
    (rt.name = 'Cheese Love' AND LOWER(r.name) LIKE '%cheese%') OR
    (rt.name = 'Veggie Love' AND (LOWER(r.name) LIKE '%veggie%' OR LOWER(r.name) LIKE '%vegetable%')) OR
    (rt.name = 'Chicken Euro' AND LOWER(r.name) LIKE '%euro%')
  )
)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT recipe_id, tag_id
FROM flavor_matches
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- Verification queries
SELECT 
  'Size Tags' as tag_type,
  COUNT(*) as assignments_count
FROM public.recipe_tag_assignments rta
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE rt.category = 'size'

UNION ALL

SELECT 
  'Type Tags' as tag_type,
  COUNT(*) as assignments_count
FROM public.recipe_tag_assignments rta
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE rt.category = 'type'

UNION ALL

SELECT 
  'Flavor Tags' as tag_type,
  COUNT(*) as assignments_count
FROM public.recipe_tag_assignments rta
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE rt.category = 'flavor';

-- Show sample tagged recipes
SELECT 
  r.name as recipe_name,
  STRING_AGG(rt.name, ', ' ORDER BY rt.category, rt.name) as tags
FROM public.recipes r
JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
GROUP BY r.id, r.name
ORDER BY r.name
LIMIT 10;

COMMIT; 