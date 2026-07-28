import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient } from '@/test/helpers/supabaseMock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

const mockedCreateClient = vi.mocked(createClient)

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/contracts/c1/custom-terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/contracts/{id}/custom-terms', () => {
  it('returns 401 when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: null }) as never)
    const response = await POST(buildRequest({ terms: ['Non-compete radius'] }), { params: { id: 'c1' } })
    expect(response.status).toBe(401)
  })

  it('returns 404 when the contract does not exist', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { contracts: { data: null, error: { message: 'not found' } } },
      }) as never
    )
    const response = await POST(buildRequest({ terms: ['Non-compete radius'] }), { params: { id: 'c1' } })
    expect(response.status).toBe(404)
  })

  it('returns an empty list without inserting when terms is empty', async () => {
    const client = createMockSupabaseClient({
      user: { id: 'u1' },
      tableResults: { contracts: { data: { id: 'c1' }, error: null } },
    })
    mockedCreateClient.mockReturnValue(client as never)

    const response = await POST(buildRequest({ terms: [] }), { params: { id: 'c1' } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.custom_terms).toEqual([])
  })

  it('returns 400 max_custom_terms_exceeded for more than 5 terms', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { contracts: { data: { id: 'c1' }, error: null } },
      }) as never
    )
    const response = await POST(
      buildRequest({ terms: ['a', 'b', 'c', 'd', 'e', 'f'] }),
      { params: { id: 'c1' } }
    )
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('max_custom_terms_exceeded')
  })

  it('inserts cleaned terms and returns 200 on success', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: { data: { id: 'c1' }, error: null },
          custom_key_terms: {
            data: [{ id: 'ct1', term_name: 'Non-compete radius' }],
            error: null,
          },
        },
      }) as never
    )
    const response = await POST(
      buildRequest({ terms: ['  Non-compete radius  ', ''] }),
      { params: { id: 'c1' } }
    )
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.custom_terms).toEqual([{ id: 'ct1', term_name: 'Non-compete radius' }])
  })

  it('maps the DB trigger error to 400 max_custom_terms_exceeded', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: { data: { id: 'c1' }, error: null },
          custom_key_terms: {
            data: null,
            error: { message: 'max_custom_terms_exceeded: a contract may have at most 5 custom key terms' },
          },
        },
      }) as never
    )
    const response = await POST(buildRequest({ terms: ['One more term'] }), { params: { id: 'c1' } })
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('max_custom_terms_exceeded')
  })
})
