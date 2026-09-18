// Staff administration with the service role, so the browser never needs
// auth.admin privileges. Every request must carry an admin user's JWT.
//
// Deploy:  npx supabase functions deploy staff-admin --project-ref <ref>
// Invoke:  supabase.functions.invoke('staff-admin', { body: { action, ... } })

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Role = 'admin' | 'branch' | 'warehouse';

type Action =
  | { action: 'create'; email: string; password: string; name: string; role: Role; location_id: string | null }
  | { action: 'update'; id: string; name: string; role: Role; location_id: string | null }
  | { action: 'deactivate'; id: string }
  | { action: 'reactivate'; id: string }
  | { action: 'reset_password'; id: string; password: string };

const ROLES: Role[] = ['admin', 'branch', 'warehouse'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const requireString = (value: unknown, field: string, { min = 1 } = {}) => {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw new HttpError(400, `${field} is required`);
  }
  return value.trim();
};

const requireRole = (value: unknown): Role => {
  if (!ROLES.includes(value as Role)) throw new HttpError(400, 'role must be admin, branch or warehouse');
  return value as Role;
};

const optionalUuid = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new HttpError(400, `${field} must be a uuid`);
  }
  return value;
};

const requireLocationForRole = (role: Role, locationId: string | null) => {
  if (role !== 'admin' && !locationId) {
    throw new HttpError(400, `${role} users must be assigned to a location`);
  }
};

async function assertCallerIsAdmin(admin: SupabaseClient, authHeader: string | null) {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Missing Authorization header');

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new HttpError(401, 'Invalid session');

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) throw new HttpError(500, profileError.message);
  if (!profile || profile.role !== 'admin' || profile.is_active === false) {
    throw new HttpError(403, 'Only active administrators can manage staff');
  }
  return userData.user;
}

async function assertNotLastActiveAdmin(admin: SupabaseClient, targetId: string) {
  const { data: target } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', targetId)
    .maybeSingle();
  if (target?.role !== 'admin' || target.is_active === false) return;

  const { count } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true);
  if ((count ?? 0) <= 1) throw new HttpError(409, 'Cannot remove the last active administrator');
}

async function handle(admin: SupabaseClient, callerId: string, body: Action) {
  switch (body.action) {
    case 'create': {
      const email = requireString(body.email, 'email').toLowerCase();
      const password = requireString(body.password, 'password', { min: 8 });
      const name = requireString(body.name, 'name');
      const role = requireRole(body.role);
      const locationId = optionalUuid(body.location_id, 'location_id');
      requireLocationForRole(role, locationId);

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role, location_id: locationId },
      });
      if (error) throw new HttpError(400, error.message);

      // handle_new_user creates the row; upsert makes the outcome deterministic
      // even if the trigger is missing on an older database.
      const { error: profileError } = await admin.from('profiles').upsert({
        id: data.user.id,
        email,
        name,
        role,
        location_id: locationId,
        is_active: true,
      });
      if (profileError) throw new HttpError(500, profileError.message);

      return { id: data.user.id };
    }

    case 'update': {
      const id = requireString(body.id, 'id');
      const name = requireString(body.name, 'name');
      const role = requireRole(body.role);
      const locationId = optionalUuid(body.location_id, 'location_id');
      requireLocationForRole(role, locationId);

      if (id === callerId && role !== 'admin') {
        throw new HttpError(409, 'You cannot remove your own admin role');
      }
      if (role !== 'admin') await assertNotLastActiveAdmin(admin, id);

      const { error: profileError } = await admin
        .from('profiles')
        .update({ name, role, location_id: locationId })
        .eq('id', id);
      if (profileError) throw new HttpError(500, profileError.message);

      const { error } = await admin.auth.admin.updateUserById(id, {
        user_metadata: { name, role, location_id: locationId },
      });
      if (error) throw new HttpError(400, error.message);
      return { id };
    }

    case 'deactivate': {
      const id = requireString(body.id, 'id');
      if (id === callerId) throw new HttpError(409, 'You cannot deactivate yourself');
      await assertNotLastActiveAdmin(admin, id);

      const { error: profileError } = await admin.from('profiles').update({ is_active: false }).eq('id', id);
      if (profileError) throw new HttpError(500, profileError.message);

      // A long ban stops token refresh; is_active=false stops RLS/RPC access immediately.
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: '876000h' });
      if (error) throw new HttpError(400, error.message);
      return { id };
    }

    case 'reactivate': {
      const id = requireString(body.id, 'id');
      const { error: profileError } = await admin.from('profiles').update({ is_active: true }).eq('id', id);
      if (profileError) throw new HttpError(500, profileError.message);
      const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: 'none' });
      if (error) throw new HttpError(400, error.message);
      return { id };
    }

    case 'reset_password': {
      const id = requireString(body.id, 'id');
      const password = requireString(body.password, 'password', { min: 8 });
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) throw new HttpError(400, error.message);
      return { id };
    }

    default:
      throw new HttpError(400, 'Unknown action');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: 'Function is missing Supabase secrets' });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const caller = await assertCallerIsAdmin(admin, req.headers.get('Authorization'));
    const body = (await req.json()) as Action;
    const result = await handle(admin, caller.id, body);

    await admin.from('activity_logs').insert({
      user_id: caller.id,
      action: `staff.${body.action}`,
      entity_type: 'profile',
      entity_id: 'id' in body ? body.id : result.id,
      details: { ...body, password: undefined },
    });

    return json(200, result);
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message });
    console.error(err);
    return json(500, { error: err instanceof Error ? err.message : 'Unexpected error' });
  }
});
