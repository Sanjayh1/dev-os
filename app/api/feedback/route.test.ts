import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient } from '@/test/helpers/supabaseMock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

const mockedCreateClient = vi.mocked(createClient)

const CONTRACT_ID = '11111111-1111-4111-8111-111111111111'

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/feedback', () => {
  it('returns 401 when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: null }) as never)
    const response = await POST(buildRequest({ contract_id: CONTRACT_ID, rating: 'up' }))
    expect(response.status).toBe(401)
  })

  it('returns 400 invalid_feedback when rating is missing', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    const response = await POST(buildRequest({ contract_id: CONTRACT_ID }))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('invalid_feedback')
  })

  it('returns 400 invalid_feedback when contract_id is not a valid UUID', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: { id: 'u1' } }) as never)
    const response = await POST(buildRequest({ contract_id: 'not-a-uuid', rating: 'up' }))
    const body = await response.json()
    expect(response.status).toBe(400)
    expect(body.error.code).toBe('invalid_feedback')
  })

  it('returns 404 when the contract does not exist', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { contracts: { data: null, error: { message: 'not found' } } },
      }) as never
    )
    const response = await POST(buildRequest({ contract_id: CONTRACT_ID, rating: 'down' }))
    expect(response.status).toBe(404)
  })

  it('inserts feedback and returns 201', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: { data: { id: CONTRACT_ID }, error: null },
          user_feedback: { data: { id: 'f1' }, error: null },
        },
      }) as never
    )
    const response = await POST(buildRequest({ contract_id: CONTRACT_ID, rating: 'up', comment: 'Great tool' }))
    const body = await response.json()
    expect(response.status).toBe(201)
    expect(body.id).toBe('f1')
  })
})
