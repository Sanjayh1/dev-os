import { createBrowserClient } from '@supabase/ssr'
import { createFakeBrowserClient } from '@/lib/testing/fakeSupabaseBrowserClient'

// E2E runs swap in an in-memory fake (lib/testing/fakeSupabaseBrowserClient.ts)
// so Playwright can drive real login/signup flows without any real Supabase
// network calls.
export function createClient() {
  if (process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1') {
    return createFakeBrowserClient() as unknown as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
