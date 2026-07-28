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
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function fakeSupabase(signUpResult: { error: { message: string } | null }) {
  return { auth: { signUp: vi.fn().mockResolvedValue(signUpResult) } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/signup', () => {
  it('returns 422 when the password is under 8 characters', async () => {
    mockedCreateClient.mockReturnValue(fakeSupabase({ error: null }) as never)
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'short' }))
    const body = await response.json()
    expect(response.status).toBe(422)
    expect(body.error.code).toBe('validation_error')
  })

  it('returns 429 when the auth rate limit is exceeded', async () => {
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 60 })
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'longenough' }))
    expect(response.status).toBe(429)
  })

  it('returns 409 when the email is already registered', async () => {
    mockedCreateClient.mockReturnValue(
      fakeSupabase({ error: { message: 'User already registered' } }) as never
    )
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'longenough' }))
    const body = await response.json()
    expect(response.status).toBe(409)
    expect(body.error.code).toBe('email_already_registered')
  })

  it('returns 200 on a successful signup', async () => {
    mockedCreateClient.mockReturnValue(fakeSupabase({ error: null }) as never)
    const response = await POST(buildRequest({ email: 'a@b.com', password: 'longenough' }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})
