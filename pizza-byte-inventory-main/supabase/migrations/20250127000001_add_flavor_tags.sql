-- Add flavor tags to the existing recipe tagging system
-- Migration: 20250127_add_flavor_tags.sql

-- Add 'flavor' to the tag_category enum
ALTER TYPE tag_category ADD VALUE IF NOT EXISTS 'flavor';

-- Insert predefined flavor tags
INSERT INTO public.recipe_tags (name, category, color, description) VALUES
-- Meat flavors
('Pepperoni', 'flavor', '#DC2626', 'Classic pepperoni flavor'),
('Italian Sausage', 'flavor', '#7C2D12', 'Spicy Italian sausage'),
('Chicken', 'flavor', '#F59E0B', 'Grilled chicken flavor'),
('Beef', 'flavor', '#991B1B', 'Ground beef flavor'),
('Ham', 'flavor', '#FCA5A5', 'Ham flavor'),
('Bacon', 'flavor', '#EF4444', 'Crispy bacon flavor'),
('Salami', 'flavor', '#B91C1C', 'Italian salami flavor'),

-- Vegetable flavors
('Mushroom', 'flavor', '#A3A3A3', 'Fresh mushroom flavor'),
('Bell Pepper', 'flavor', '#16A34A', 'Sweet bell pepper'),
('Onion', 'flavor', '#F3F4F6', 'Fresh onion flavor'),
('Tomato', 'flavor', '#EF4444', 'Fresh tomato flavor'),
('Spinach', 'flavor', '#15803D', 'Fresh spinach flavor'),
('Olive', 'flavor', '#374151', 'Mediterranean olive flavor'),
('Jalapeño', 'flavor', '#16A34A', 'Spicy jalapeño pepper'),
('Pineapple', 'flavor', '#FCD34D', 'Sweet pineapple flavor'),

-- Cheese flavors
('Mozzarella', 'flavor', '#FEF3C7', 'Classic mozzarella cheese'),
('Cheddar', 'flavor', '#F59E0B', 'Sharp cheddar cheese'),
('Parmesan', 'flavor', '#FEF9C3', 'Aged parmesan cheese'),
('Ricotta', 'flavor', '#F9FAFB', 'Creamy ricotta cheese'),
('Feta', 'flavor', '#E5E7EB', 'Tangy feta cheese'),
('Goat Cheese', 'flavor', '#F3F4F6', 'Creamy goat cheese'),

-- Sauce flavors
('Marinara', 'flavor', '#DC2626', 'Classic marinara sauce'),
('BBQ', 'flavor', '#7C2D12', 'Tangy BBQ sauce'),
('Buffalo', 'flavor', '#EA580C', 'Spicy buffalo sauce'),
('Alfredo', 'flavor', '#F9FAFB', 'Creamy alfredo sauce'),
('Pesto', 'flavor', '#16A34A', 'Basil pesto sauce'),
('Ranch', 'flavor', '#F3F4F6', 'Creamy ranch sauce'),

-- Cuisine styles
('Italian', 'flavor', '#16A34A', 'Traditional Italian flavors'),
('Mexican', 'flavor', '#EF4444', 'Mexican-inspired flavors'),
('Mediterranean', 'flavor', '#3B82F6', 'Mediterranean flavors'),
('American', 'flavor', '#DC2626', 'Classic American flavors'),
('Spicy', 'flavor', '#DC2626', 'Hot and spicy flavors'),
('Mild', 'flavor', '#6B7280', 'Mild and gentle flavors'),
('Vegetarian', 'flavor', '#16A34A', 'Vegetarian-friendly'),
('Vegan', 'flavor', '#059669', 'Plant-based only')

ON CONFLICT (name, category) DO NOTHING;

-- Update the constraint function to allow multiple flavor tags per recipe
-- (since recipes can have multiple flavors, unlike size/type which should be unique)
DROP TRIGGER IF EXISTS trigger_enforce_one_tag_per_category ON public.recipe_tag_assignments;
DROP FUNCTION IF EXISTS enforce_one_tag_per_category();

-- Create updated function that only restricts size and type categories
CREATE OR REPLACE FUNCTION enforce_one_tag_per_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if recipe already has a tag of the same category
  -- Only enforce uniqueness for 'size' and 'type' categories, not 'flavor'
  IF EXISTS (
    SELECT 1 
    FROM public.recipe_tag_assignments rta
    JOIN public.recipe_tags rt ON rta.tag_id = rt.id
    WHERE rta.recipe_id = NEW.recipe_id 
    AND rt.category = (
      SELECT category 
      FROM public.recipe_tags 
      WHERE id = NEW.tag_id
    )
    AND rt.category IN ('size', 'type')  -- Only restrict these categories
    AND rta.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Recipe can only have one tag per category for size and type';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_enforce_one_tag_per_category
  BEFORE INSERT OR UPDATE ON public.recipe_tag_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_one_tag_per_category();

-- Update the view to include all tags
DROP VIEW IF EXISTS public.recipe_with_tags;
CREATE OR REPLACE VIEW public.recipe_with_tags AS
SELECT 
  r.*,
  COALESCE(
    json_agg(
      json_build_object(
        'id', rt.id,
        'name', rt.name,
        'category', rt.category,
        'color', rt.color,
        'description', rt.description
      )
    ) FILTER (WHERE rt.id IS NOT NULL), 
    '[]'::json
  ) as tags
FROM public.recipes r
LEFT JOIN public.recipe_tag_assignments rta ON r.id = rta.recipe_id
LEFT JOIN public.recipe_tags rt ON rta.tag_id = rt.id
GROUP BY r.id, r.name, r.description, r.created_at, r.updated_at;

COMMENT ON VIEW public.recipe_with_tags IS 'View that includes recipes with their associated tags (size, type, and flavor)'; 