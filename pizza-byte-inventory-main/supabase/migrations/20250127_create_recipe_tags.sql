-- Create recipe tagging system for pizza sizes and types
-- Migration: 20250127_create_recipe_tags.sql

-- Create tag categories enum
CREATE TYPE tag_category AS ENUM ('size', 'type');

-- Create recipe_tags table
CREATE TABLE IF NOT EXISTS public.recipe_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  category tag_category NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6', -- Default blue color for tags
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique tag names within each category
  UNIQUE(name, category)
);

-- Create recipe_tag_assignments table (junction table)
CREATE TABLE IF NOT EXISTS public.recipe_tag_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.recipe_tags(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_by UUID, -- Could reference auth.users if needed
  
  -- Ensure a recipe can only have one tag per category
  UNIQUE(recipe_id, tag_id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_recipe_tag_assignments_recipe_id ON public.recipe_tag_assignments(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tag_assignments_tag_id ON public.recipe_tag_assignments(tag_id);

-- Insert predefined size tags
INSERT INTO public.recipe_tags (name, category, color, description) VALUES
('7 inch', 'size', '#EF4444', 'Small personal pizza size'),
('9 inch', 'size', '#F59E0B', 'Small to medium pizza size'),
('12 inch', 'size', '#10B981', 'Medium pizza size'),
('16 inch', 'size', '#3B82F6', 'Large pizza size'),
('16 inch Half', 'size', '#6366F1', 'Half of large pizza'),
('21 inch', 'size', '#8B5CF6', 'Extra large pizza size'),
('21 inch Half', 'size', '#EC4899', 'Half of extra large pizza'),
('21 inch Slice', 'size', '#F43F5E', 'Single slice of extra large pizza')
ON CONFLICT (name, category) DO NOTHING;

-- Insert predefined type tags
INSERT INTO public.recipe_tags (name, category, color, description) VALUES
('Standard', 'type', '#059669', 'Regular pizza crust'),
('Thin Crust', 'type', '#DC2626', 'Thin and crispy pizza crust')
ON CONFLICT (name, category) DO NOTHING;

-- Insert calzone size tags
INSERT INTO public.recipe_tags (name, category, color, description) VALUES
('Full Calzone', 'size', '#7C3AED', 'Full-size calzone'),
('Half Calzone', 'size', '#DB2777', 'Half-size calzone'),
('Slice Calzone', 'size', '#DC2626', 'Single slice calzone'),
('Mini Calzone', 'size', '#EA580C', 'Mini personal calzone')
ON CONFLICT (name, category) DO NOTHING;

-- Create function to ensure only one tag per category per recipe
CREATE OR REPLACE FUNCTION enforce_one_tag_per_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if recipe already has a tag of the same category
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
    AND rta.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Recipe can only have one tag per category';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce the constraint
CREATE TRIGGER trigger_enforce_one_tag_per_category
  BEFORE INSERT OR UPDATE ON public.recipe_tag_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_one_tag_per_category();

-- Enable Row Level Security (RLS)
ALTER TABLE public.recipe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON public.recipe_tags
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.recipe_tags
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.recipe_tags
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.recipe_tags
  FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.recipe_tag_assignments
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.recipe_tag_assignments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON public.recipe_tag_assignments
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON public.recipe_tag_assignments
  FOR DELETE USING (true);

-- Create updated_at trigger for recipe_tags
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recipe_tags_updated_at
  BEFORE UPDATE ON public.recipe_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE public.recipe_tags IS 'Stores available tags for recipes (size, type, etc.)';
COMMENT ON TABLE public.recipe_tag_assignments IS 'Junction table connecting recipes to their tags';
COMMENT ON COLUMN public.recipe_tags.category IS 'Category of tag: size or type';
COMMENT ON COLUMN public.recipe_tags.color IS 'Hex color code for tag display';
COMMENT ON FUNCTION enforce_one_tag_per_category() IS 'Ensures recipes can only have one tag per category';

-- Create view for easy recipe tag retrieval
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

COMMENT ON VIEW public.recipe_with_tags IS 'View that includes recipes with their associated tags'; 