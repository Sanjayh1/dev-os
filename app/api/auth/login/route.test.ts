import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  rateLimitedResponse: vi.fn((retryAfterSeconds: number) => {
    const res = NextResponse.json({ error: { code: 'rate_limited', message: 'slow down' } }, { status: 429 })
    res.headers.set('Retry-After', String(retryAfterSeconds))
    return res
  }),
}))

import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { POST } from './route'

const mockedCreateClient = vi.mocked(createClient)
const mockedCheckRateLimit = vi.mocked(checkRateLimit)

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function fakeSupabase(signInResult: { error: { message: string } | null }) {
  return { auth: { signInWithPassword: vi.fn().mockResolvedValue(signInResult) } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/login', () => {
  it('returns 422 for a malformed email', async () => {
    mockedCreateClient.mockReturnValue(fakeSupabase({ error: null }) as never)
    const response = await POST(buildRequest({ email: 'not-an-email', password: 'whatever' }))
    const body = await response.json()
    expect(response.status).toBe(422)
    expect(body.error.code).toBe('validation_error')
  })

  it('does not reject a short password — login defers to Supabase Auth for correctness', async () => {
    mockedCreateClient.mockReturnValue(fakeSupabase({ error: null }) as never)
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'short' }))
    expect(response.status).toBe(200)
  })

  it('returns 429 when the auth rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 })
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'whatever' }))
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
  })

  it('returns 401 invalid_credentials without revealing which field was wrong', async () => {
    mockedCreateClient.mockReturnValue(
      fakeSupabase({ error: { message: 'Invalid login credentials' } }) as never
    )
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'wrongpassword' }))
    const body = await response.json()
    expect(response.status).toBe(401)
    expect(body.error.code).toBe('invalid_credentials')
  })

  it('returns 200 on a successful login', async () => {
    mockedCreateClient.mockReturnValue(fakeSupabase({ error: null }) as never)
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'correctpassword' }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})
