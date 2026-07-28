import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createFakeServerClient } from '@/lib/testing/fakeSupabaseServerClient'

// E2E runs swap in an in-memory fake (lib/testing/fakeSupabaseServerClient.ts)
// so Playwright can drive real flows — including middleware's auth gate —
// without any real Supabase network calls.
export function createClient() {
  const cookieStore = cookies()

  if (process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1') {
    return createFakeServerClient(
      (name) => cookieStore.get(name)?.value,
      (name, value) => cookieStore.set(name, value, { path: '/' }),
      (name) => cookieStore.set(name, '', { path: '/', maxAge: 0 })
    ) as unknown as ReturnType<typeof createServerClient>
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => cookieStore.set(name, value, options),
        remove: (name: string, options: CookieOptions) => cookieStore.set(name, '', options),
      },
    }
  )
}
