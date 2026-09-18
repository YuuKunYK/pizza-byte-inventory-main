import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/auth';

export interface StaffProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  location_id: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  locations?: { id: string; name: string } | null;
}

type StaffAction =
  | { action: 'create'; email: string; password: string; name: string; role: UserRole; location_id: string | null }
  | { action: 'update'; id: string; name: string; role: UserRole; location_id: string | null }
  | { action: 'deactivate'; id: string }
  | { action: 'reactivate'; id: string }
  | { action: 'reset_password'; id: string; password: string };

const isFunctionMissing = (message?: string, status?: number) => {
  if (status === 404 || status === 405 || status === 503) return true;
  const text = message?.toLowerCase() || '';
  return (
    text.includes('failed to send a request') ||
    text.includes('not found') ||
    text.includes('404') ||
    text.includes('non-2xx') ||
    text.includes('failed to fetch') ||
    (text.includes('function') && (text.includes('not') || text.includes('missing')))
  );
};

const invokeStaffAdmin = async (body: StaffAction): Promise<{ id: string } | null> => {
  const { data, error } = await supabase.functions.invoke<{ id: string; error?: string }>('staff-admin', {
    body,
  });

  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  if (error && isFunctionMissing(error.message, status)) {
    return null;
  }

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === 'function') {
      try {
        const payload = await context.json();
        if (payload?.error) throw new Error(payload.error);
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input' && !parseError.message.includes('JSON')) {
          throw parseError;
        }
      }
    }
    throw new Error(error.message || 'Staff operation failed');
  }

  if (data?.error) throw new Error(data.error);
  if (data?.id) return data;
  return null;
};

const browserFallback = async (body: StaffAction): Promise<{ id: string }> => {
  if (body.action === 'create') {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentSession = sessionData.session;
    if (!currentSession) throw new Error('Admin session not available');

    const { data: userData, error: signUpError } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          name: body.name,
          role: body.role,
          location_id: body.location_id,
        },
      },
    });
    if (signUpError) throw signUpError;
    if (!userData.user?.id) throw new Error('User was not created');

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userData.user.id,
      email: body.email,
      name: body.name,
      role: body.role,
      location_id: body.location_id,
    });
    if (profileError) throw profileError;

    await supabase.auth.setSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    });
    return { id: userData.user.id };
  }

  if (body.action === 'update') {
    const { error } = await supabase
      .from('profiles')
      .update({ name: body.name, role: body.role, location_id: body.location_id })
      .eq('id', body.id);
    if (error) throw error;
    return { id: body.id };
  }

  throw new Error(
    'The staff-admin Edge Function is not deployed, so deactivate / password reset are unavailable. Profile updates and new users still work.'
  );
};

/**
 * Prefers the staff-admin Edge Function. Falls back to the previous browser
 * signUp/profile path so the admin Users page still works before that function
 * is deployed.
 */
export const staffAdmin = async (body: StaffAction): Promise<{ id: string }> => {
  const fromFunction = await invokeStaffAdmin(body);
  if (fromFunction) return fromFunction;
  return browserFallback(body);
};

export const fetchStaffProfiles = async (): Promise<StaffProfile[]> => {
  const selects = [
    'id, email, name, role, location_id, is_active, created_at, updated_at, locations:location_id(id, name)',
    'id, email, name, role, location_id, created_at, updated_at, locations:location_id(id, name)',
    'id, email, name, role, location_id, created_at, updated_at, locations(id, name)',
    'id, email, name, role, location_id, created_at, updated_at',
  ];

  let lastError: { message?: string } | null = null;
  for (const select of selects) {
    const { data, error } = await supabase
      .from('profiles')
      .select(select)
      .order('created_at', { ascending: false });
    if (!error) return (data || []) as unknown as StaffProfile[];
    lastError = error;
  }

  throw lastError || new Error('Could not load staff profiles');
};
