// In-memory backend used only when NEXT_PUBLIC_E2E_MOCK_BACKEND=1 (see
// lib/supabase/server.ts, lib/supabase/client.ts, middleware.ts,
// lib/openai/client.ts). Lets Playwright drive the real app through a real
// browser — including middleware's auth gate — without any real Supabase or
// OpenAI network calls. Never referenced when the flag is unset.

export interface FakeUser {
  id: string
  email: string
  password: string
}

type Tables = Record<string, Record<string, unknown>[]>

const SEED_USER: FakeUser = { id: 'e2e-user-1', email: 'e2e@test.local', password: 'password123' }

let users: FakeUser[] = [SEED_USER]
let tables: Tables = {}

export function resetFakeBackend() {
  users = [{ ...SEED_USER }]
  tables = {
    contracts: [],
    key_terms: [],
    custom_key_terms: [],
    chat_sessions: [],
    chat_messages: [],
    user_feedback: [],
    term_corrections: [],
  }
}
resetFakeBackend()

export function getTables(): Tables {
  return tables
}

export function findUserByCredentials(email: string, password: string): FakeUser | null {
  return users.find((u) => u.email === email && u.password === password) ?? null
}

export function createUser(email: string, password: string): FakeUser {
  const existing = users.find((u) => u.email === email)
  if (existing) return existing
  const user: FakeUser = { id: `e2e-user-${users.length + 1}`, email, password }
  users.push(user)
  return user
}

export const SESSION_COOKIE_NAME = 'e2e_fake_session'
