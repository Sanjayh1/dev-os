import { describe, expect, it } from 'vitest'
import { verifyContractOwnership, verifySessionOwnership } from './chatSecurity'

function fakeSupabase(result: { data: unknown; error: unknown }) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => result,
        }),
      }),
    }),
  }
}

describe('verifyContractOwnership', () => {
  it('returns the contract when found', async () => {
    const supabase = fakeSupabase({ data: { id: 'c1' }, error: null })
    const { contract, response } = await verifyContractOwnership(supabase as never, 'c1', 'id')
    expect(response).toBeNull()
    expect(contract).toEqual({ id: 'c1' })
  })

  it('returns a 404 response when not found (covers both nonexistent and not-owned — RLS makes them indistinguishable)', async () => {
    const supabase = fakeSupabase({ data: null, error: { message: 'no rows' } })
    const { contract, response } = await verifyContractOwnership(supabase as never, 'c1', 'id')
    expect(contract).toBeNull()
    expect(response?.status).toBe(404)
  })
})

describe('verifySessionOwnership', () => {
  it('returns the session when found', async () => {
    const supabase = fakeSupabase({ data: { id: 's1' }, error: null })
    const { session, response } = await verifySessionOwnership(supabase as never, 's1')
    expect(response).toBeNull()
    expect(session).toEqual({ id: 's1' })
  })

  it('returns a 404 response when not found', async () => {
    const supabase = fakeSupabase({ data: null, error: { message: 'no rows' } })
    const { session, response } = await verifySessionOwnership(supabase as never, 's1')
    expect(session).toBeNull()
    expect(response?.status).toBe(404)
  })
})
