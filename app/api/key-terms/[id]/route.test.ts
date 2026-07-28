import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient } from '@/test/helpers/supabaseMock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { PATCH } from './route'

const mockedCreateClient = vi.mocked(createClient)

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/key-terms/kt1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PATCH /api/key-terms/{id}', () => {
  it('returns 401 when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: null }) as never)
    const response = await PATCH(buildRequest({ value: 'Delaware' }), { params: { id: 'kt1' } })
    expect(response.status).toBe(401)
  })

  it('returns 400 invalid_value for an empty string', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    const response = await PATCH(buildRequest({ value: '   ' }), { params: { id: 'kt1' } })
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('invalid_value')
  })

  it('returns 404 term_not_found when the term does not exist', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { key_terms: { data: null, error: { message: 'not found' } } },
      }) as never
    )
    const response = await PATCH(buildRequest({ value: 'Delaware' }), { params: { id: 'kt1' } })
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.error.code).toBe('term_not_found')
  })

  it('sets original_ai_value from the current value on a first edit', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          key_terms: {
            data: {
              id: 'kt1',
              value: 'Californai', // original AI typo, being corrected
              original_ai_value: null,
              contract_id: 'c1',
              term_name: 'Governing Law',
            },
            error: null,
          },
          contracts: { data: { contract_type: 'NDA' }, error: null },
        },
      }) as never
    )
    const response = await PATCH(buildRequest({ value: 'California' }), { params: { id: 'kt1' } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toEqual({
      id: 'kt1',
      value: 'California',
      is_edited: true,
      original_ai_value: 'Californai',
    })
  })

  it('preserves the original_ai_value baseline when the term is edited again', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          key_terms: {
            data: {
              id: 'kt1',
              value: 'California', // already-edited value
              original_ai_value: 'Californai', // true AI baseline, preserved
              contract_id: 'c1',
              term_name: 'Governing Law',
            },
            error: null,
          },
          contracts: { data: { contract_type: 'NDA' }, error: null },
        },
      }) as never
    )
    const response = await PATCH(buildRequest({ value: 'State of California' }), { params: { id: 'kt1' } })
    const body = await response.json()
    expect(body.original_ai_value).toBe('Californai')
    expect(body.value).toBe('State of California')
  })
})
