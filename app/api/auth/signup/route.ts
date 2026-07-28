import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api/errors'
import { signupCredentialsSchema, validateBody } from '@/lib/security/inputValidator'
import { checkRateLimit, rateLimitedResponse } from '@/lib/security/rateLimiter'

// Spec: skills/security-foundation/SKILL.md §1, §3
// POST /api/auth/signup — server-side, same rationale as /api/auth/login.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const validation = validateBody(signupCredentialsSchema, body)
  if (!validation.success) {
    return apiError(422, 'validation_error', validation.error ?? 'Invalid request.')
  }
  const { email, password } = validation.data!

  const rateLimit = await checkRateLimit({ identifier: email.toLowerCase() }, 'auth')
  if (!rateLimit.allowed) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds)
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    if (/already registered|already exists|already been registered/i.test(error.message)) {
      return apiError(409, 'email_already_registered', 'Email already registered')
    }
    return apiError(400, 'signup_failed', error.message)
  }

  return NextResponse.json({ ok: true })
}
