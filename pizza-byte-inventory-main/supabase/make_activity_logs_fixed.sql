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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_user_id_fkey'
  ) THEN
    ALTER TABLE public.activity_logs 
    ADD CONSTRAINT activity_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_location_id_fkey'
  ) THEN
    ALTER TABLE public.activity_logs 
    ADD CONSTRAINT activity_logs_location_id_fkey 
    FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
  END IF;
END
$$;

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

-- Drop existing log_activity functions to avoid the duplicate function error
DO $$
DECLARE
  _funcname text := 'log_activity';
  _argnames text[];
  _argtypes text[];
  _args text;
  _nargs int;
BEGIN
  FOR _argnames, _argtypes, _args, _nargs IN
    SELECT  p.proargnames, string_to_array(oidvectortypes(p.proargtypes), ', ') as arg_data_types,
            pg_get_function_arguments(p.oid) as args, p.pronargs as nargs
    FROM    pg_proc p
    INNER JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE   n.nspname = 'public'
    AND     p.proname = _funcname
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s);', _funcname, _args);
  END LOOP;
END
$$;

-- Create log_activity function to insert activity logs
CREATE OR REPLACE FUNCTION public.log_activity(
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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.activity_logs LIMIT 1) THEN
    -- Insert a test record
    INSERT INTO public.activity_logs (
      action, 
      entity_type, 
      entity_id, 
      details, 
      created_at
    ) VALUES (
      'create', 
      'system', 
      '00000000-0000-0000-0000-000000000000', 
      '{"message": "Activity log system initialized"}', 
      now()
    );
  END IF;
END
$$; 