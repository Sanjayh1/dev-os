import { createAdminClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api/errors'

// Sliding-window rate limiting backed by the rate_limit_events table
// (supabase/rls-policies.sql). Always reads/writes via createAdminClient()
// (service role) — if a user could write their own rows here, they could
// clear or pad their own count.
//
// Authenticated actions (chat/process/upload) key by user_id, exactly as
// the security-foundation skill's schema assumes. Auth itself (login/signup)
// is the one action that can't: a wrong-password login or a signup for an
// email nobody has used yet has no user_id to key by, and that's precisely
// the case this limit exists to slow down. So `identifier` (the attempted
// email, lowercased) is a second, nullable key column alongside user_id —
// a deliberate deviation from the skill's NOT NULL user_id column, without
// which "10 requests/minute" on Authentication would be unenforceable for
// the attacks it's meant to stop.

export type RateLimitAction = 'auth' | 'chat' | 'process' | 'upload'

interface RateLimitConfig {
  windowMs: number
  max: number
}

const LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  auth: { windowMs: 60_000, max: 10 },
  process: { windowMs: 60 * 60_000, max: 5 },
  chat: { windowMs: 60_000, max: 30 },
  upload: { windowMs: 24 * 60 * 60_000, max: 20 },
}

export type RateLimitKey = { userId: string } | { identifier: string }

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

export async function checkRateLimit(key: RateLimitKey, action: RateLimitAction): Promise<RateLimitResult> {
  // E2E runs are fully offline by design (see lib/testing/) — rate limiting
  // isn't something those tests exercise, and calling the real admin client
  // here would be a real network call, breaking that. Always-allow instead
  // of adding a fake rate_limit_events table for a control nothing verifies.
  if (process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1') {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  const config = LIMITS[action]
  const windowStart = new Date(Date.now() - config.windowMs).toISOString()
  const retryAfterSeconds = Math.ceil(config.windowMs / 1000)
  const admin = createAdminClient()

  const countQuery = admin
    .from('rate_limit_events')
    .select('*', { count: 'exact', head: true })
    .eq('action', action)
    .gte('created_at', windowStart)
  const { count } =
    'userId' in key ? await countQuery.eq('user_id', key.userId) : await countQuery.eq('identifier', key.identifier)

  if ((count ?? 0) >= config.max) {
    return { allowed: false, retryAfterSeconds }
  }

  if ('userId' in key) {
    await admin.from('rate_limit_events').insert({ user_id: key.userId, action })
  } else {
    await admin.from('rate_limit_events').insert({ identifier: key.identifier, action })
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  const response = apiError(429, 'rate_limited', "You're sending requests too quickly — please wait a moment.")
  response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}
