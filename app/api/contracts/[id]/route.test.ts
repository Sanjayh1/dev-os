import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSupabaseClient } from '@/test/helpers/supabaseMock'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { DELETE, GET } from './route'

const mockedCreateClient = vi.mocked(createClient)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/contracts/{id}', () => {
  it('returns 401 when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: null }) as never)
    const response = await GET(new NextRequest('http://localhost/api/contracts/c1'), { params: { id: 'c1' } })
    expect(response.status).toBe(401)
  })

  it('returns 404 when the contract does not exist', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { contracts: { data: null, error: { message: 'not found' } } },
      }) as never
    )
    const response = await GET(new NextRequest('http://localhost/api/contracts/c1'), { params: { id: 'c1' } })
    const body = await response.json()
    expect(response.status).toBe(404)
    expect(body.error.code).toBe('contract_not_found')
  })

  it('returns null signed_url without throwing when file_path is null', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: {
            data: {
              id: 'c1',
              file_name: 'x.pdf',
              contract_type: 'NDA',
              page_count: 3,
              status: 'completed',
              contract_text: '[PAGE 1]\ntext',
              file_path: null,
            },
            error: null,
          },
          key_terms: { data: [], error: null },
          custom_key_terms: { data: [], error: null },
        },
      }) as never
    )
    const response = await GET(new NextRequest('http://localhost/api/contracts/c1'), { params: { id: 'c1' } })
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.signed_url).toBeNull()
    expect(body.contract.file_path).toBeUndefined()
  })

  it('generates a signed_url when file_path is present', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: {
            data: {
              id: 'c1',
              file_name: 'x.pdf',
              contract_type: 'NDA',
              page_count: 3,
              status: 'completed',
              contract_text: 'text',
              file_path: 'u1/c1/x.pdf',
            },
            error: null,
          },
          key_terms: { data: [], error: null },
          custom_key_terms: { data: [], error: null },
        },
        storageSignedUrl: { data: { signedUrl: 'https://signed.example/x.pdf' }, error: null },
      }) as never
    )
    const response = await GET(new NextRequest('http://localhost/api/contracts/c1'), { params: { id: 'c1' } })
    const body = await response.json()
    expect(body.signed_url).toBe('https://signed.example/x.pdf')
  })
})

describe('DELETE /api/contracts/{id}', () => {
  it('returns 401 when there is no session', async () => {
    mockedCreateClient.mockReturnValue(createMockSupabaseClient({ user: null }) as never)
    const response = await DELETE(new NextRequest('http://localhost/api/contracts/c1'), { params: { id: 'c1' } })
    expect(response.status).toBe(401)
  })

  it('returns 404 when the contract does not exist', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: { contracts: { data: null, error: { message: 'not found' } } },
      }) as never
    )
    const response = await DELETE(new NextRequest('http://localhost/api/contracts/c1'), { params: { id: 'c1' } })
    expect(response.status).toBe(404)
  })

  it('returns 204 on successful deletion', async () => {
    mockedCreateClient.mockReturnValue(
      createMockSupabaseClient({
        user: { id: 'u1' },
        tableResults: {
          contracts: [
            { data: { id: 'c1', file_path: 'u1/c1/x.pdf' }, error: null },
            { data: null, error: null },
          ],
        },
      }) as never
    )
    const response = await DELETE(new NextRequest('http://localhost/api/contracts/c1'), { params: { id: 'c1' } })
    expect(response.status).toBe(204)
  })
})
