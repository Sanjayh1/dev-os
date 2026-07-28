import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/errors'
import { loginCredentialsSchema, validateBody } from '@/lib/security/inputValidator'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rateLimiter'

// Spec: skills/security-foundation/SKILL.md §1, §3
// POST /api/auth/login — server-side so the session cookie is set via
// createClient() and login attempts can be rate limited; the client must
// call this instead of supabase.auth.signInWithPassword() directly.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const validation = validateBody(loginCredentialsSchema, body)
  if (!validation.success) {
    return apiError(422, 'validation_error', validation.error ?? 'Invalid request.')
  }
  const { email, password } = validation.data!

  const rateLimit = await checkRateLimit({ identifier: email.toLowerCase() }, 'auth')
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds)
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Never reveal which field is wrong — prevents user enumeration.
    return apiError(401, 'invalid_credentials', 'Invalid email or password')
  }

  return NextResponse.json({ ok: true })
}
