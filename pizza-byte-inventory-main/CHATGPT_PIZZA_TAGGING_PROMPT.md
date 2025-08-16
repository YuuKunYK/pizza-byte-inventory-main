# ChatGPT Prompt for Pizza Recipe Tagging

## Task
Generate SQL statements to automatically tag existing pizza recipes in my database with appropriate size and type tags based on their recipe names.

## Context
I have a pizza restaurant database with:
1. **Recipes table** (`public.recipes`) - Contains pizza recipes with names like "21 inch Margherita", "12 inch Pepperoni Thin Crust", etc.
2. **Recipe tags system** - New tagging system with predefined size and type tags
3. **Need to automatically tag existing pizzas** based on their names

## Available Tags

### Size Tags (category: 'size'):

**Pizza Sizes:**
- '7 inch' (color: #EF4444)
- '9 inch' (color: #F59E0B) 
- '12 inch' (color: #10B981)
- '16 inch' (color: #3B82F6)
- '16 inch Half' (color: #6366F1)
- '21 inch' (color: #8B5CF6)
- '21 inch Half' (color: #EC4899)
- '21 inch Slice' (color: #F43F5E)

**Calzone Sizes:**
- 'Full Calzone' (color: #7C3AED)
- 'Half Calzone' (color: #DB2777)
- 'Slice Calzone' (color: #DC2626)
- 'Mini Calzone' (color: #EA580C)

### Type Tags (category: 'type'):
- 'Standard' (color: #059669)
- 'Thin Crust' (color: #DC2626)

## Database Schema

```sql
-- Recipes table
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY,
  name VARCHAR NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Tags table (already populated)
CREATE TABLE public.recipe_tags (
  id UUID PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  category tag_category NOT NULL, -- 'size' or 'type'
  color VARCHAR(7),
  description TEXT
);

-- Tag assignments table
CREATE TABLE public.recipe_tag_assignments (
  id UUID PRIMARY KEY,
  recipe_id UUID REFERENCES public.recipes(id),
  tag_id UUID REFERENCES public.recipe_tags(id)
);
```

## Instructions

1. **Analyze recipe names** to identify pizza size and crust type
2. **Generate INSERT statements** to assign appropriate tags
3. **Handle edge cases** where names might be ambiguous
4. **Only tag pizza recipes** (ignore sides, desserts, beverages, etc.)

### Matching Rules:

**Size Detection:**

*For Pizzas:*
- Look for exact matches: "7 inch", "9 inch", "12 inch", "16 inch", "21 inch"
- Handle variations: "7", "7-inch", "7 inches", "7'"
- Detect "Half" and "Slice" variations: "16 inch Half", "21 inch Slice"
- Default to "12 inch" if recipe name suggests pizza but no size found

*For Calzones:*
- Look for "Full Calzone", "Full", "Large Calzone" → Tag as "Full Calzone"
- Look for "Half Calzone", "Half", "Medium Calzone" → Tag as "Half Calzone"  
- Look for "Slice Calzone", "Slice", "Single Calzone" → Tag as "Slice Calzone"
- Look for "Mini Calzone", "Mini", "Small Calzone", "Personal Calzone" → Tag as "Mini Calzone"
- Default to "Full Calzone" if recipe name suggests calzone but no size found

**Type Detection:**
- Look for "Thin Crust", "Thin", "Crispy" → Tag as "Thin Crust"
- Look for "Standard", "Regular", "Classic" → Tag as "Standard"  
- If no type specified but recipe is pizza → Tag as "Standard"
- Calzones typically don't have crust types, so only assign type tags to pizzas

**Recipe Detection:**

*Pizza Detection:*
- Recipe names containing: "pizza", "margherita", "pepperoni", "supreme", "hawaiian", "veggie", "meat", "bbq", "buffalo", etc.
- Exclude: "sauce", "dip", "side", "drink", "dessert", "calzone", "pasta"

*Calzone Detection:*
- Recipe names containing: "calzone", "calzones"
- Common calzone names: "Meat Calzone", "Veggie Calzone", "Cheese Calzone", "Pepperoni Calzone", etc.
- Exclude: "pizza", "sauce", "dip", "side", "drink", "dessert"

## Required Output Format

```sql
-- Auto-generated pizza recipe tagging
-- Generated on: [DATE]

-- First, get all recipe and tag data for reference
WITH pizza_recipes AS (
  SELECT id, name, LOWER(name) as lower_name
  FROM public.recipes 
  WHERE LOWER(name) LIKE '%pizza%' 
     OR LOWER(name) LIKE '%margherita%'
     OR LOWER(name) LIKE '%pepperoni%'
     OR LOWER(name) LIKE '%supreme%'
     OR LOWER(name) LIKE '%hawaiian%'
     OR LOWER(name) LIKE '%veggie%'
     OR LOWER(name) LIKE '%meat%'
     OR LOWER(name) LIKE '%bbq%'
     OR LOWER(name) LIKE '%buffalo%'
     -- Add more pizza indicators
),
calzone_recipes AS (
  SELECT id, name, LOWER(name) as lower_name
  FROM public.recipes 
  WHERE LOWER(name) LIKE '%calzone%'
),
all_recipes AS (
  SELECT * FROM pizza_recipes
  UNION ALL
  SELECT * FROM calzone_recipes
),
size_tags AS (
  SELECT id, name FROM public.recipe_tags WHERE category = 'size'
),
type_tags AS (
  SELECT id, name FROM public.recipe_tags WHERE category = 'type'
)

-- Insert pizza size tag assignments
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT r.id, st.id
FROM pizza_recipes r
CROSS JOIN size_tags st
WHERE 
  -- Pizza size matching logic
  (st.name = '7 inch' AND (r.lower_name LIKE '%7 inch%' OR r.lower_name LIKE '%7"%' OR r.lower_name LIKE '%7 %' OR r.lower_name LIKE '%personal%'))
  OR (st.name = '9 inch' AND (r.lower_name LIKE '%9 inch%' OR r.lower_name LIKE '%9"%' OR r.lower_name LIKE '%9 %'))
  OR (st.name = '12 inch' AND (r.lower_name LIKE '%12 inch%' OR r.lower_name LIKE '%12"%' OR r.lower_name LIKE '%12 %' OR r.lower_name LIKE '%medium%'))
  OR (st.name = '16 inch' AND (r.lower_name LIKE '%16 inch%' OR r.lower_name LIKE '%16"%' OR r.lower_name LIKE '%16 %' OR r.lower_name LIKE '%large%'))
  OR (st.name = '16 inch Half' AND (r.lower_name LIKE '%16 inch half%' OR r.lower_name LIKE '%16" half%'))
  OR (st.name = '21 inch' AND (r.lower_name LIKE '%21 inch%' OR r.lower_name LIKE '%21"%' OR r.lower_name LIKE '%21 %' OR r.lower_name LIKE '%extra large%' OR r.lower_name LIKE '%xl%'))
  OR (st.name = '21 inch Half' AND (r.lower_name LIKE '%21 inch half%' OR r.lower_name LIKE '%21" half%'))
  OR (st.name = '21 inch Slice' AND (r.lower_name LIKE '%21 inch slice%' OR r.lower_name LIKE '%21" slice%'))
  -- Continue for all pizza sizes...
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- Insert calzone size tag assignments
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT r.id, st.id
FROM calzone_recipes r
CROSS JOIN size_tags st
WHERE 
  -- Calzone size matching logic
  (st.name = 'Full Calzone' AND (r.lower_name LIKE '%full%' OR r.lower_name LIKE '%large%' OR (r.lower_name LIKE '%calzone%' AND NOT (r.lower_name LIKE '%half%' OR r.lower_name LIKE '%slice%' OR r.lower_name LIKE '%mini%'))))
  OR (st.name = 'Half Calzone' AND (r.lower_name LIKE '%half%' OR r.lower_name LIKE '%medium%'))
  OR (st.name = 'Slice Calzone' AND (r.lower_name LIKE '%slice%' OR r.lower_name LIKE '%single%'))
  OR (st.name = 'Mini Calzone' AND (r.lower_name LIKE '%mini%' OR r.lower_name LIKE '%small%' OR r.lower_name LIKE '%personal%'))
ON CONFLICT (recipe_id, tag_id) DO NOTHING;

-- Insert pizza type tag assignments (only for pizzas, not calzones)
INSERT INTO public.recipe_tag_assignments (recipe_id, tag_id)
SELECT DISTINCT r.id, tt.id
FROM pizza_recipes r
CROSS JOIN type_tags tt
WHERE 
  -- Type matching logic for pizzas only
  (tt.name = 'Thin Crust' AND (r.lower_name LIKE '%thin%' OR r.lower_name LIKE '%crispy%'))
  OR (tt.name = 'Standard' AND NOT (r.lower_name LIKE '%thin%' OR r.lower_name LIKE '%crispy%'))
ON CONFLICT (recipe_id, tag_id) DO NOTHING;
```

## Example Recipe Names to Handle:

**Pizza Examples:**
- "21 inch Margherita Pizza"
- "12 inch Pepperoni Thin Crust"  
- "16 inch Half Supreme"
- "Margherita Standard 9 inch"
- "BBQ Chicken Pizza Large" (should get 16 inch as default for "Large")
- "Personal Veggie Pizza" (should get 7 inch for "Personal")

**Calzone Examples:**
- "Full Meat Calzone" (should get "Full Calzone" size tag)
- "Half Veggie Calzone" (should get "Half Calzone" size tag)
- "Mini Cheese Calzone" (should get "Mini Calzone" size tag)
- "Pepperoni Calzone Slice" (should get "Slice Calzone" size tag)
- "Large Spinach Calzone" (should get "Full Calzone" size tag)
- "Personal Calzone" (should get "Mini Calzone" size tag)

## Additional Requirements:
1. **Use transactions** to ensure data integrity
2. **Add verification queries** to show results
3. **Handle duplicates** with ON CONFLICT DO NOTHING
4. **Add comments** explaining the logic
5. **Include rollback instructions** if needed

## Expected Deliverable:
Complete, executable SQL script that can be run directly on the database to tag all existing pizza recipes appropriately. 