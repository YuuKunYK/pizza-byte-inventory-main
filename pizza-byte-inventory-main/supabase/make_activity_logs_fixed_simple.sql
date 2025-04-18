-- Check if table exists already
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  location_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key constraints if they don't exist already
BEGIN;
  -- Try to add constraints, ignore errors if they already exist
  ALTER TABLE public.activity_logs 
  DROP CONSTRAINT IF EXISTS activity_logs_user_id_fkey;
  
  ALTER TABLE public.activity_logs 
  DROP CONSTRAINT IF EXISTS activity_logs_location_id_fkey;
  
  ALTER TABLE public.activity_logs 
  ADD CONSTRAINT activity_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  
  ALTER TABLE public.activity_logs 
  ADD CONSTRAINT activity_logs_location_id_fkey 
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
COMMIT;

-- Grant access to authenticated users
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any before recreating
DROP POLICY IF EXISTS "View activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Insert own activity logs" ON public.activity_logs;

-- Create policy to allow read access for all authenticated users
CREATE POLICY "View activity logs" ON public.activity_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy to allow insert for authenticated users (can only log their own activities)
CREATE POLICY "Insert own activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Try dropping existing functions with different signatures
DROP FUNCTION IF EXISTS public.log_activity(UUID, TEXT, TEXT, TEXT, JSON, UUID);
DROP FUNCTION IF EXISTS public.log_activity(UUID, TEXT, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.log_activity(UUID, TEXT, TEXT, TEXT, JSON);
DROP FUNCTION IF EXISTS public.log_activity(UUID, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.log_activity(UUID, TEXT, TEXT, TEXT);

-- Create log_activity function to insert activity logs
CREATE FUNCTION public.log_activity(
  _user_id UUID,
  _action TEXT,
  _entity_type TEXT,
  _entity_id TEXT,
  _details JSONB,
  _location_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    location_id,
    created_at
  ) VALUES (
    _user_id,
    _action,
    _entity_type,
    _entity_id,
    _details,
    _location_id,
    now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;

-- Create or recreate indexes for faster queries
DROP INDEX IF EXISTS activity_logs_entity_idx;
DROP INDEX IF EXISTS activity_logs_user_idx;
DROP INDEX IF EXISTS activity_logs_created_at_idx;
DROP INDEX IF EXISTS activity_logs_location_idx;

CREATE INDEX activity_logs_entity_idx ON public.activity_logs (entity_type, entity_id);
CREATE INDEX activity_logs_user_idx ON public.activity_logs (user_id);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX activity_logs_location_idx ON public.activity_logs (location_id);

-- Add sample data if table is empty
INSERT INTO public.activity_logs (
  action, 
  entity_type, 
  entity_id, 
  details, 
  created_at
) 
SELECT 
  'create', 
  'system', 
  '00000000-0000-0000-0000-000000000000', 
  '{"message": "Activity log system initialized"}', 
  now()
WHERE 
  NOT EXISTS (SELECT 1 FROM public.activity_logs LIMIT 1); 