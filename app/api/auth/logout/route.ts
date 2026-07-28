import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Spec: skills/security-foundation/SKILL.md §1
// POST /api/auth/logout — the client must call this instead of calling
// supabase.auth.signOut() directly, for the same server-side-cookie reason
// as login/signup.
export async function POST() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
