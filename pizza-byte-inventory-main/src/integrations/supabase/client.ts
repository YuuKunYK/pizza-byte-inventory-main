import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://uajdrfwhfkfbwzgtixtk.supabase.co';
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhamRyZndoZmtmYnd6Z3RpeHRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTk2NjksImV4cCI6MjA2MDEzNTY2OX0.x50quc-lHAbMF7Fuse_P3FbKs2nlZTqSulK9SECL5ho';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
