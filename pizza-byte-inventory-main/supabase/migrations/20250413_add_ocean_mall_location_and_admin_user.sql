
-- Insert Ocean Mall location if it doesn't exist
INSERT INTO public.locations (name, type, address)
SELECT 'Ocean Mall', 'branch', 'Ocean Mall Address'
WHERE NOT EXISTS (
  SELECT 1 FROM public.locations WHERE name = 'Ocean Mall'
);

-- Note: In a production environment, user creation would be done through the application.
-- This is for development purposes only.
-- Create the admin user through a function to avoid exposing the password in migrations
DO $$
DECLARE
  location_id uuid;
  user_id uuid;
BEGIN
  -- Get Ocean Mall location id
  SELECT id INTO location_id FROM public.locations WHERE name = 'Ocean Mall';
  
  -- If location doesn't exist for some reason, create it
  IF location_id IS NULL THEN
    INSERT INTO public.locations (name, type, address)
    VALUES ('Ocean Mall', 'branch', 'Ocean Mall Address')
    RETURNING id INTO location_id;
  END IF;
  
  -- Check if the user already exists
  PERFORM 1 FROM auth.users WHERE email = 'yousufkhatri2006@gmail.com';
  
  -- If user doesn't exist, create it
  IF NOT FOUND THEN
    -- We can't directly insert into auth.users, so we'll rely on the auth API
    -- For now, create a placeholder profile record that will be filled by the app
    INSERT INTO public.profiles (id, name, email, role, location_id)
    VALUES (
      gen_random_uuid(), -- This will be replaced when the actual user signs up
      'Yousuf Khatri',
      'yousufkhatri2006@gmail.com',
      'admin', -- Set as admin
      location_id
    );
  END IF;
END
$$;
