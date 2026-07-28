# Spec: Authentication

**Source:** engineering-doc.md §4 Flow 1–2, §6, §9; implementation-specs.md "Authentication"
**Code paths:** `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`

---

## User Flow

**Sign up:** Landing page → "Get Started Free" → sign-up form (email, password, confirm password) → client validation → `supabase.auth.signUp()` → redirect to `/dashboard` on success; inline error on failure.

**Sign in:** `/login` → email + password → `supabase.auth.signInWithPassword()` → redirect to `/dashboard`.

**Sign out:** any authenticated page → `supabase.auth.signOut()` → redirect to `/login`.

No custom API route is involved — `@supabase/ssr` handles session issuance and cookie storage directly from the client.

---

## DB Schema Touched

`auth.users` (Supabase-managed). No custom `profiles` table at MVP.

---

## API Routes

None. All auth operations go through `supabase-js` (`@supabase/ssr`) directly from the frontend.

---

## Middleware

`middleware.ts` runs on every request matching `/dashboard/:path*` and `/contracts/:path*`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => response.cookies.set(name, value, options),
        remove: (name, options) => response.cookies.set(name, '', options),
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/contracts/:path*'],
}
```

Every API route under `app/api/*` additionally validates the session server-side via `createServerClient` inside the handler before processing (defense-in-depth — do not rely on middleware alone for API routes).

---

## State Management

Session held in a root-layout Supabase session provider (`@supabase/ssr`). No React Query — session changes trigger a router refresh (`router.refresh()`) so server components re-render with the new auth state.

---

## Component Spec

- **`app/(auth)/signup/page.tsx`** — email, password, confirm-password fields. Client validation: email format (regex), password length ≥ 8, password === confirm. Submit button disables + shows spinner while `signUp()` is in flight.
- **`app/(auth)/login/page.tsx`** — email, password. "Forgot password" link triggers `supabase.auth.resetPasswordForEmail()` (Supabase-hosted reset flow, no custom page needed at MVP).

---

## Design Notes

Form inputs: 44px height, `#CBD5E1` border (Border Strong), `#112E81` focus border (Primary), per `skills/design-system/SKILL.md`. Primary button style (`#112E81` bg, white text) for "Sign Up" / "Sign In" submit actions.

---

## Edge Cases

| Case | Behavior |
|---|---|
| Email already registered | Inline error: "Email already registered" — never a generic 500 |
| Password < 8 chars | Inline validation before submit, no network call |
| Invalid credentials on login | Generic "Invalid email or password" — do not reveal which field is wrong (prevents user enumeration) |
| Auth call exceeds ~10s | Show timeout-specific message ("Taking longer than usual — please try again"), not an indefinite spinner |
| Unauthenticated request to `/dashboard` or `/contracts/*` | Middleware redirects to `/login` before any page code runs |
