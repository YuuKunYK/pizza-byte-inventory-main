// Runtime schema is the live remote database. Keep this untyped so the client
// compiles without a generated dump; regenerate with
// `npx supabase gen types typescript` when the local stack is applied.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = any;
