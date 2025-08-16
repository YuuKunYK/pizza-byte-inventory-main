-- ================================================================
-- AUTO-GENERATED PIZZA / CALZONE TAGGING SCRIPT (FIXED V2)
-- Generated on: 2025-01-27
-- ================================================================
-- WHAT THIS DOES
-- 1) Identifies pizza + calzone recipes by name patterns
-- 2) Tags them with the correct size tag (ONE per recipe, priority-based)
-- 3) Tags pizzas with the correct type tag (ONE per recipe)
-- 4) Uses priority to select best match when multiple patterns match
-- 5) Wraps everything in a transaction so you can ROLLBACK
-- ================================================================

BEGIN;

-- ------------------------
-- Helpful: enforce uniqueness (run once, ignore errors on re-run)
-- ------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'recipe_tag_assignments_recipe_id_tag_id_key'
  ) THEN
    EXECUTE 'ALTER TABLE public.recipe_tag_assignments
             ADD CONSTRAINT recipe_tag_assignments_recipe_id_tag_id_key
             UNIQUE (recipe_id, tag_id)';
  END IF;
END$$;

-- ------------------------
-- CTEs: detect pizzas / calzones and existing tags
-- ------------------------
WITH
pizza_recipes AS (
  SELECT id, name, LOWER(name) AS lower_name
  FROM public.recipes
  WHERE
        -- strong signal: contains 'pizza'
        LOWER(name) LIKE '%pizza%'
     OR LOWER(name) LIKE '%margherita%'
     OR LOWER(name) LIKE '%pepperoni%'
     OR LOWER(name) LIKE '%supreme%'
     OR LOWER(name) LIKE '%hawaiian%'
     OR LOWER(name) LIKE '%veggie%'
     OR LOWER(name) LIKE '%meat%'
     OR LOWER(name) LIKE '%bbq%'
     OR LOWER(name) LIKE '%buffalo%'
     OR LOWER(name) LIKE '%tikka%'
     OR LOWER(name) LIKE '%fajita%'
     OR LOWER(name) LIKE '%brooklyn%'
     OR LOWER(name) LIKE '%ranch%'
     OR LOWER(name) LIKE '%creamy%'
     OR LOWER(name) LIKE '%sicilian%' -- add anything else you use
),
calzone_recipes AS (
  SELECT id, name, LOWER(name) AS lower_name
  FROM public.recipes
  WHERE LOWER(name) LIKE '%calzone%'
),
all_size_tags AS (
  SELECT id, name
  FROM public.recipe_tags
  WHERE category = 'size'
),
all_type_tags AS (
  SELECT id, name
  FROM public.recipe_tags
  WHERE category = 'type'
),

-- -------------------------------------------------
-- SIZE detection for PIZZAS with PRIORITY
-- -------------------------------------------------
pizza_size_matches AS (
  SELECT 
    r.id AS recipe_id, 
    st.id AS tag_id,
    st.name AS tag_name,
    CASE 
      -- More specific patterns get higher priority
      WHEN st.name = '21 inch Slice' AND (r.lower_name LIKE '%21 inch slice%' OR r.lower_name LIKE '%21" slice%' OR r.lower_name LIKE '%21 slice%') THEN 1
      WHEN st.name = '21 inch Half' AND (r.lower_name LIKE '%21 inch half%' OR r.lower_name LIKE '%21" half%' OR r.lower_name LIKE '%21 half%') THEN 2
      WHEN st.name = '16 inch Half' AND (r.lower_name LIKE '%16 inch half%' OR r.lower_name LIKE '%16" half%' OR r.lower_name LIKE '%16 half%') THEN 3
      WHEN st.name = '21 inch' AND (r.lower_name LIKE '%21 inch%' OR r.lower_name LIKE '%21"%' OR r.lower_name LIKE '% 21 %' OR r.lower_name LIKE '%extra large%' OR r.lower_name LIKE '%xl%') THEN 4
      WHEN st.name = '16 inch' AND (r.lower_name LIKE '%16 inch%' OR r.lower_name LIKE '%16"%' OR r.lower_name LIKE '% 16 %' OR r.lower_name LIKE '%large%') THEN 5
      WHEN st.name = '12 inch' AND (r.lower_name LIKE '%12 inch%' OR r.lower_name LIKE '%12"%' OR r.lower_name LIKE '% 12 %' OR r.lower_name LIKE '%medium%') THEN 6
      WHEN st.name = '9 inch' AND (r.lower_name LIKE '%9 inch%' OR r.lower_name LIKE '%9"%' OR r.lower_name LIKE '% 9 %') THEN 7
      WHEN st.name = '7 inch' AND (r.lower_name LIKE '%7 inch%' OR r.lower_name LIKE '%7"%' OR r.lower_name LIKE '% 7 %' OR r.lower_name LIKE '%personal%') THEN 8
      ELSE NULL
    END AS priority
  FROM pizza_recipes r
  CROSS JOIN all_size_tags st
  WHERE st.name NOT LIKE '%Calzone%'
),

pizza_size_detect AS (
  SELECT recipe_id, tag_id
  FROM (
    SELECT 
      recipe_id, 
      tag_id,
      ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY priority) as rn
    FROM pizza_size_matches
    WHERE priority IS NOT NULL
  ) ranked
  WHERE rn = 1  -- Only take the highest priority match per recipe
),

-- -------------------------------------------------
-- SIZE detection for CALZONES with PRIORITY
-- -------------------------------------------------
calzone_size_matches AS (
  SELECT 
    r.id AS recipe_id, 
    st.id AS tag_id,
    st.name AS tag_name,
    CASE 
      -- More specific patterns get higher priority
      WHEN st.name = 'Slice Calzone' AND (r.lower_name LIKE '%slice%' OR r.lower_name LIKE '%single%') THEN 1
      WHEN st.name = 'Half Calzone' AND (r.lower_name LIKE '%half%' OR r.lower_name LIKE '%medium%') THEN 2
      WHEN st.name = 'Mini Calzone' AND (r.lower_name LIKE '%mini%' OR r.lower_name LIKE '%small%' OR r.lower_name LIKE '%personal%') THEN 3
      WHEN st.name = 'Full Calzone' AND (r.lower_name LIKE '%full%' OR r.lower_name LIKE '%large%' OR (r.lower_name LIKE '%calzone%' AND NOT (r.lower_name LIKE '%half%' OR r.lower_name LIKE '%slice%' OR r.lower_name LIKE '%mini%'))) THEN 4
      ELSE NULL
    END AS priority
  FROM calzone_recipes r
  CROSS JOIN all_size_tags st
  WHERE st.name LIKE '%Calzone%'
),

calzone_size_detect AS (
  SELECT recipe_id, tag_id
  FROM (
    SELECT 
      recipe_id, 
      tag_id,
      ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY priority) as rn
    FROM calzone_size_matches
    WHERE priority IS NOT NULL
  ) ranked
  WHERE rn = 1  -- Only take the highest priority match per recipe
),

-- -------------------------------------------------
-- TYPE detection for PIZZAS with PRIORITY
-- -------------------------------------------------
pizza_type_matches AS (
  SELECT 
    r.id AS recipe_id, 
    tt.id AS tag_id,
    tt.name AS tag_name,
    CASE 
      -- Thin crust is more specific, gets higher priority
      WHEN tt.name = 'Thin Crust' AND (r.lower_name LIKE '%thin%' OR r.lower_name LIKE '%crispy%') THEN 1
      WHEN tt.name = 'Standard' AND NOT (r.lower_name LIKE '%thin%' OR r.lower_name LIKE '%crispy%') THEN 2
      ELSE NULL
    END AS priority
  FROM pizza_recipes r
  CROSS JOIN all_type_tags tt
),

pizza_type_detect AS (
  SELECT recipe_id, tag_id
  FROM (
    SELECT 
      recipe_id, 
      tag_id,
      ROW_NUMBER() OVER (PARTITION BY recipe_id ORDER BY priority) as rn
    FROM pizza_type_matches
    WHERE priority IS NOT NULL
  ) ranked
  WHERE rn = 1  -- Only take the highest priority match per recipe
),

-- -------------------------------------------------
-- Default assignments for recipes without matches
-- -------------------------------------------------
pizza_default_size AS (
  SELECT r.id AS recipe_id, st.id AS tag_id
  FROM pizza_recipes r
  CROSS JOIN all_size_tags st
  WHERE st.name = '12 inch'  -- Default to 12 inch
    AND r.id NOT IN (SELECT recipe_id FROM pizza_size_detect)
),

calzone_default_size AS (
  SELECT r.id AS recipe_id, st.id AS tag_id
  FROM calzone_recipes r
  CROSS JOIN all_size_tags st
  WHERE st.name = 'Full Calzone'  -- Default to Full
    AND r.id NOT IN (SELECT recipe_id FROM calzone_size_detect)
)

-- ========================================
-- INSERT STATEMENTS: Apply all the tags
-- ========================================

-- 1) Insert pizza size tags (specific matches - only one per recipe)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT recipe_id, tag_id FROM pizza_size_detect
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- 2) Insert calzone size tags (specific matches - only one per recipe)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT recipe_id, tag_id FROM calzone_size_detect
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- 3) Insert pizza default size tags (for pizzas without specific size)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT recipe_id, tag_id FROM pizza_default_size
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- 4) Insert calzone default size tags (for calzones without specific size)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT recipe_id, tag_id FROM calzone_default_size
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- 5) Insert pizza type tags (only one per recipe)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT recipe_id, tag_id FROM pizza_type_detect
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Show what was tagged
SELECT 'TAGGING RESULTS' as status;

SELECT 'Pizza recipes tagged:' as category, count(DISTINCT r.id) as count
FROM public.recipes r
JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%margherita%' OR LOWER(r.name) LIKE '%pepperoni%';

SELECT 'Calzone recipes tagged:' as category, count(DISTINCT r.id) as count
FROM public.recipes r
JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE LOWER(r.name) LIKE '%calzone%';

-- Check for constraint violations (should be 0)
SELECT 'Recipes with multiple size tags:' as check_type, count(*) as violations
FROM (
  SELECT rta.recipe_id, count(*) as tag_count
  FROM public.recipe_tag_assignments rta
  JOIN public.recipe_tags rt ON rta.tag_id = rt.id
  WHERE rt.category = 'size'
  GROUP BY rta.recipe_id
  HAVING count(*) > 1
) violations;

SELECT 'Recipes with multiple type tags:' as check_type, count(*) as violations
FROM (
  SELECT rta.recipe_id, count(*) as tag_count
  FROM public.recipe_tag_assignments rta
  JOIN public.recipe_tags rt ON rta.tag_id = rt.id
  WHERE rt.category = 'type'
  GROUP BY rta.recipe_id
  HAVING count(*) > 1
) violations;

-- Show sample tagged recipes
SELECT 'SAMPLE TAGGED RECIPES' as status;

SELECT 
  r.name as recipe_name,
  string_agg(rt.name, ', ' ORDER BY rt.category, rt.name) as tags
FROM public.recipes r
JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%calzone%'
GROUP BY r.id, r.name
ORDER BY r.name
LIMIT 10;

-- ========================================
-- COMMIT OR ROLLBACK
-- ========================================

-- Review the results above, then:
-- COMMIT;  -- to save changes
-- ROLLBACK;  -- to undo changes

SELECT 'Transaction ready - run COMMIT; to save or ROLLBACK; to undo' as instruction; 