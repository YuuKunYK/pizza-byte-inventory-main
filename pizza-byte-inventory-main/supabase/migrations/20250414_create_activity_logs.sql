-- Create activity_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Grant access to authenticated users
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access for all authenticated users
CREATE POLICY "View activity logs" ON public.activity_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Create policy to allow insert for authenticated users (can only log their own activities)
CREATE POLICY "Insert own activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

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
GRANT EXECUTE ON FUNCTION public.log_activity TO authenticated;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON public.activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_logs_user_idx ON public.activity_logs (user_id);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_location_idx ON public.activity_logs (location_id); 