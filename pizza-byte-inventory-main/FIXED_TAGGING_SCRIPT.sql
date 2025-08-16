-- ================================================================
-- AUTO-GENERATED PIZZA / CALZONE TAGGING SCRIPT
-- Generated on: 2025-01-27
-- ================================================================
-- WHAT THIS DOES
-- 1) Identifies pizza + calzone recipes by name patterns
-- 2) Tags them with the correct size tag (or default)
-- 3) Tags pizzas with the correct type tag (or default "Standard")
-- 4) Uses ON CONFLICT DO NOTHING to avoid duplicates
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
-- SIZE detection for PIZZAS
-- -------------------------------------------------
pizza_size_detect AS (
  SELECT r.id AS recipe_id, st.id AS tag_id
  FROM pizza_recipes r
  JOIN all_size_tags st ON TRUE
  WHERE
    (st.name = '7 inch'          AND (r.lower_name LIKE '%7 inch%' OR r.lower_name LIKE '%7"%' OR r.lower_name LIKE '% 7 %' OR r.lower_name LIKE '%personal%'))
 OR (st.name = '9 inch'          AND (r.lower_name LIKE '%9 inch%' OR r.lower_name LIKE '%9"%' OR r.lower_name LIKE '% 9 %'))
 OR (st.name = '12 inch'         AND (r.lower_name LIKE '%12 inch%' OR r.lower_name LIKE '%12"%' OR r.lower_name LIKE '% 12 %' OR r.lower_name LIKE '%medium%'))
 OR (st.name = '16 inch'         AND (r.lower_name LIKE '%16 inch%' OR r.lower_name LIKE '%16"%' OR r.lower_name LIKE '% 16 %' OR r.lower_name LIKE '%large%'))
 OR (st.name = '16 inch Half'    AND (r.lower_name LIKE '%16 inch half%' OR r.lower_name LIKE '%16" half%' OR r.lower_name LIKE '%16 half%'))
 OR (st.name = '21 inch'         AND (r.lower_name LIKE '%21 inch%' OR r.lower_name LIKE '%21"%' OR r.lower_name LIKE '% 21 %' OR r.lower_name LIKE '%extra large%' OR r.lower_name LIKE '%xl%'))
 OR (st.name = '21 inch Half'    AND (r.lower_name LIKE '%21 inch half%' OR r.lower_name LIKE '%21" half%' OR r.lower_name LIKE '%21 half%'))
 OR (st.name = '21 inch Slice'   AND (r.lower_name LIKE '%21 inch slice%' OR r.lower_name LIKE '%21" slice%' OR r.lower_name LIKE '%21 slice%'))
),

-- -------------------------------------------------
-- SIZE detection for CALZONES
-- -------------------------------------------------
calzone_size_detect AS (
  SELECT r.id AS recipe_id, st.id AS tag_id
  FROM calzone_recipes r
  JOIN all_size_tags st ON TRUE
  WHERE
    (st.name = 'Full Calzone'     AND (r.lower_name LIKE '%full%' OR r.lower_name LIKE '%large%' OR (r.lower_name LIKE '%calzone%' AND NOT (r.lower_name LIKE '%half%' OR r.lower_name LIKE '%slice%' OR r.lower_name LIKE '%mini%'))))
 OR (st.name = 'Half Calzone'     AND (r.lower_name LIKE '%half%' OR r.lower_name LIKE '%medium%'))
 OR (st.name = 'Slice Calzone'    AND (r.lower_name LIKE '%slice%' OR r.lower_name LIKE '%single%'))
 OR (st.name = 'Mini Calzone'     AND (r.lower_name LIKE '%mini%' OR r.lower_name LIKE '%small%' OR r.lower_name LIKE '%personal%'))
),

-- -------------------------------------------------
-- TYPE detection for PIZZAS (only pizzas get type tags)
-- -------------------------------------------------
pizza_type_detect AS (
  SELECT r.id AS recipe_id, tt.id AS tag_id
  FROM pizza_recipes r
  JOIN all_type_tags tt ON TRUE
  WHERE
    (tt.name = 'Thin Crust'  AND (r.lower_name LIKE '%thin%' OR r.lower_name LIKE '%crispy%'))
 OR (tt.name = 'Standard'    AND NOT (r.lower_name LIKE '%thin%' OR r.lower_name LIKE '%crispy%'))
),

-- -------------------------------------------------
-- Default size assignments for pizzas without specific size
-- -------------------------------------------------
pizza_default_size AS (
  SELECT r.id AS recipe_id, st.id AS tag_id
  FROM pizza_recipes r
  JOIN all_size_tags st ON st.name = '12 inch'  -- Default to 12 inch
  WHERE r.id NOT IN (SELECT recipe_id FROM pizza_size_detect)
),

-- -------------------------------------------------
-- Default size assignments for calzones without specific size
-- -------------------------------------------------
calzone_default_size AS (
  SELECT r.id AS recipe_id, st.id AS tag_id
  FROM calzone_recipes r
  JOIN all_size_tags st ON st.name = 'Full Calzone'  -- Default to Full
  WHERE r.id NOT IN (SELECT recipe_id FROM calzone_size_detect)
)

-- ========================================
-- INSERT STATEMENTS: Apply all the tags
-- ========================================

-- 1) Insert pizza size tags (specific matches)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT recipe_id, tag_id FROM pizza_size_detect
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- 2) Insert calzone size tags (specific matches)
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

-- 5) Insert pizza type tags (all pizzas get a type)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT recipe_id, tag_id FROM pizza_type_detect
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Show what was tagged
SELECT 'TAGGING RESULTS' as status;

SELECT 'Pizza recipes tagged:' as category, count(*) as count
FROM public.recipes r
JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE LOWER(r.name) LIKE '%pizza%' OR LOWER(r.name) LIKE '%margherita%' OR LOWER(r.name) LIKE '%pepperoni%';

SELECT 'Calzone recipes tagged:' as category, count(*) as count
FROM public.recipes r
JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
JOIN public.recipe_tags rt ON rta.tag_id = rt.id
WHERE LOWER(r.name) LIKE '%calzone%';

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