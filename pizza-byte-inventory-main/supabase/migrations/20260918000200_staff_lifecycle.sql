-- =============================================================================
-- Staff lifecycle: deactivation instead of deletion.
-- Staff accounts are managed by the staff-admin Edge Function (service role).
-- An inactive profile resolves to role 'none', which every RLS policy and RPC
-- already rejects, so deactivation takes effect on the very next request.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_is_active_idx ON public.profiles(is_active);

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role::text FROM public.profiles WHERE id = auth.uid() AND is_active),
    'none'
  );
$$;

-- Users may update their own name but never their role, location or status.
DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = public.current_profile_role()
    AND is_active = true
    AND location_id IS NOT DISTINCT FROM public.current_profile_location_id()
  );

-- Admins read every profile; everyone else only their own.
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin() OR id = auth.uid());

-- Inserts and deletes go through the Edge Function (service role) only.
DROP POLICY IF EXISTS profiles_admin ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
