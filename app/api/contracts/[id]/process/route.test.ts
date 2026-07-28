import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient } from '@/test/helpers/supabaseMock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/openai/client', () => ({ openai: { chat: { completions: { create: vi.fn() } } } }))
vi.mock('@/lib/security/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
  rateLimitedResponse: vi.fn((retryAfterSeconds: number) => {
    const res = NextResponse.json({ error: { code: 'rate_limited', message: 'slow down' } }, { status: 429 })
    res.headers.set('Retry-After', String(retryAfterSeconds))
    return res
  }),
}))

import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai/client'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { POST } from './route'

const mockedCreateClient = vi.mocked(createClient)
const mockedCreateCompletion = vi.mocked(openai.chat.completions.create)
const mockedCheckRateLimit = vi.mocked(checkRateLimit)

function buildRequest() {
  return new NextRequest('http://localhost/api/contracts/c1/process', { method: 'POST' })
}

function chatCompletion(content: string) {
  return { choices: [{ message: { content } }] } as never
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/contracts/{id}/process', () => {
  it('returns 401 when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: null }) as never)

    const response = await POST(buildRequest(), { params: { id: 'c1' } })
    expect(response.status).toBe(401)
  })

  it('returns 404 when the contract does not exist (or is not owned)', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { contracts: { data: null, error: { message: 'not found' } } },
      }) as never
    )

    const response = await POST(buildRequest(), { params: { id: 'c1' } })
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.error.code).toBe('contract_not_found')
  })

  it('returns 422 when the contract is not in uploaded status', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: { data: { id: 'c1', contract_type: 'NDA', contract_text: 'text', status: 'completed' }, error: null },
        },
      }) as never
    )

    const response = await POST(buildRequest(), { params: { id: 'c1' } })
    const body = await response.json()
    expect(response.status).toBe(422)
    expect(body.error.code).toBe('contract_not_uploaded')
  })

  it('extracts terms, applies the confidence floor, and returns completed on success', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: { data: { id: 'c1', contract_type: 'NDA', contract_text: '[PAGE 1]\ntext', status: 'uploaded' }, error: null },
          custom_key_terms: { data: [], error: null },
          key_terms: {
            data: [
              {
                id: 'kt1',
                term_name: 'Governing Law',
                value: 'Delaware',
                page_number: 1,
                confidence_score: 90,
                source_sentence: 'Governed by Delaware law.',
                is_custom: false,
              },
            ],
            error: null,
          },
        },
      }) as never
    )
    mockedCreateCompletion.mockResolvedValue(
      chatCompletion(
        JSON.stringify({
          terms: [
            {
              term_name: 'Governing Law',
              value: 'Delaware',
              page_number: 1,
              confidence_score: 90,
              source_sentence: 'Governed by Delaware law.',
              is_custom: false,
            },
          ],
        })
      )
    )

    const response = await POST(buildRequest(), { params: { id: 'c1' } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('completed')
    expect(body.key_terms).toHaveLength(1)
  })

  it('marks the contract as error and returns 502 when the model never returns valid JSON', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: { data: { id: 'c1', contract_type: 'NDA', contract_text: 'text', status: 'uploaded' }, error: null },
          custom_key_terms: { data: [], error: null },
        },
      }) as never
    )
    mockedCreateCompletion.mockResolvedValue(chatCompletion('not json'))

    const response = await POST(buildRequest(), { params: { id: 'c1' } })
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error.code).toBe('openai_extraction_failed')
    // one corrective retry attempted on top of the initial call
    expect(mockedCreateCompletion).toHaveBeenCalledTimes(2)
  })

  it('returns 502 after exhausting network retries', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: { data: { id: 'c1', contract_type: 'NDA', contract_text: 'text', status: 'uploaded' }, error: null },
          custom_key_terms: { data: [], error: null },
        },
      }) as never
    )
    mockedCreateCompletion.mockRejectedValue(new Error('network down'))

    const response = await POST(buildRequest(), { params: { id: 'c1' } })
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body.error.code).toBe('openai_extraction_failed')
    expect(mockedCreateCompletion).toHaveBeenCalledTimes(3)
  }, 10000)

  it('returns 429 when the process rate limit is exceeded', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    mockedCheckRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 })

    const response = await POST(buildRequest(), { params: { id: 'c1' } })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('3600')
  })
})
