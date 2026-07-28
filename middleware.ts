import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createFakeServerClient } from '@/lib/testing/fakeSupabaseServerClient'

// Spec: skills/security-foundation/SKILL.md §1
// Protects /dashboard and /contracts (chat lives inside /contracts/[id]/results,
// there's no standalone /chat route; no /settings or /profile pages exist in
// this app). Also redirects an already-authenticated visitor away from
// /login and /signup, back to /dashboard.
const PROTECTED_PATHS = ['/dashboard', '/contracts']
const AUTH_PATHS = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase =
    process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND === '1'
      ? createFakeServerClient((name) => request.cookies.get(name)?.value)
      : createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              get: (name: string) => request.cookies.get(name)?.value,
              set: (name: string, value: string, options: CookieOptions) =>
                response.cookies.set(name, value, options),
              remove: (name: string, options: CookieOptions) => response.cookies.set(name, '', options),
            },
          }
        )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path))
  const isAuthPage = AUTH_PATHS.some((path) => pathname.startsWith(path))

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (isAuthPage && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/contracts/:path*', '/login', '/signup'],
}
