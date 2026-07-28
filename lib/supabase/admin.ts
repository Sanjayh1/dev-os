import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// SERVER ONLY, and only for what genuinely needs to bypass RLS — currently
// just lib/security/rateLimiter.ts. Rate-limit counters must not be
// readable/writable by the user they're counting, or a user could clear
// their own limit; every other read/write in this app goes through the
// RLS-scoped client in lib/supabase/server.ts.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
