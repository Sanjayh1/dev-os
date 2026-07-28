import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { POST } from './route'

const mockedCreateClient = vi.mocked(createClient)

describe('POST /api/auth/logout', () => {
  it('calls signOut and returns 200', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null })
    mockedCreateClient.mockReturnValue({ auth: { signOut } } as never)

    const response = await POST()
    const body = await response.json()

    expect(signOut).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })
})
