import { fakeFrom } from './fakeQueryBuilder'
import { fakeStorageFrom } from './fakeStorage'
import { SESSION_COOKIE_NAME, createUser, findUserByCredentials } from './fakeBackendStore'

// Server-side fake Supabase client for E2E runs. Auth is a plaintext cookie
// (SESSION_COOKIE_NAME -> user id) — not a real session token, just enough
// for this app's own getUser()/getSession()/signIn/signUp/signOut usage
// contract to hold across middleware + routes.
//
// getCookie deliberately does NOT look the id up against fakeBackendStore's
// users list for getUser()/getSession(): middleware runs in the Edge runtime
// while API routes run in the Node runtime, and Next.js bundles each as a
// separate module instance — a user created via a Node-runtime route isn't
// visible to middleware's Edge-runtime copy of the store. Trusting the
// cookie's id directly sidesteps that split entirely, which is all a session
// check needs. signInWithPassword/signUp DO look the user up, since those
// only ever run in the Node runtime (API routes), where the store is shared.
export function createFakeServerClient(
  getCookie: (name: string) => string | undefined,
  setCookie?: (name: string, value: string) => void,
  clearCookie?: (name: string) => void
) {
  function currentUser() {
    const userId = getCookie(SESSION_COOKIE_NAME)
    if (!userId) return null
    return { id: userId, email: '' }
  }

  return {
    auth: {
      async getUser() {
        return { data: { user: currentUser() } }
      },
      async getSession() {
        const user = currentUser()
        return { data: { session: user ? { user } : null } }
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const user = findUserByCredentials(email, password)
        if (!user) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
        }
        setCookie?.(SESSION_COOKIE_NAME, user.id)
        return { data: { user: { id: user.id, email: user.email }, session: { user: { id: user.id } } }, error: null }
      },
      async signUp({ email, password }: { email: string; password: string }) {
        const user = createUser(email, password)
        setCookie?.(SESSION_COOKIE_NAME, user.id)
        return { data: { user: { id: user.id, email: user.email }, session: { user: { id: user.id } } }, error: null }
      },
      async signOut() {
        clearCookie?.(SESSION_COOKIE_NAME)
        return { error: null }
      },
    },
    from: fakeFrom,
    storage: {
      from: fakeStorageFrom,
    },
  }
}
