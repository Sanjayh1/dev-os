'use client'

// Browser-side fake Supabase client for E2E runs. Login/signup/logout go
// through app/api/auth/*/route.ts (server-side, per the security-foundation
// requirement that auth writes happen server-side so they can be rate
// limited) rather than through this client — see
// lib/testing/fakeSupabaseServerClient.ts for the E2E-mode auth logic those
// routes end up calling into. This client only covers what's still
// genuinely client-side: direct data reads (e.g. the dashboard) and password
// reset.

interface QuerySpec {
  table: string
  filters: Array<[string, unknown]>
  order?: { column: string; ascending: boolean }
  limit?: number
  count?: 'exact'
  head?: boolean
}

// Pages that query Supabase directly client-side (e.g. the dashboard, per
// docs/specs/dashboard.md — no dedicated API route) can't reach the server's
// in-memory fakeBackendStore directly, so this proxies each query through
// /api/test/query, which runs the same fakeQueryBuilder the API routes use.
function createFakeQuery(table: string) {
  const spec: QuerySpec = { table, filters: [] }

  async function execute() {
    const response = await fetch('/api/test/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    })
    return response.json()
  }

  const query = {
    select(_columns?: string, options?: { count?: 'exact'; head?: boolean }) {
      if (options?.count) spec.count = options.count
      if (options?.head) spec.head = options.head
      return query
    },
    eq(col: string, val: unknown) {
      spec.filters.push([col, val])
      return query
    },
    order(col: string, opts?: { ascending?: boolean }) {
      spec.order = { column: col, ascending: opts?.ascending ?? true }
      return query
    },
    limit(n: number) {
      spec.limit = n
      return query
    },
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
      return execute().then(onFulfilled, onRejected)
    },
  }

  return query
}

export function createFakeBrowserClient() {
  return {
    from: createFakeQuery,
    auth: {
      async resetPasswordForEmail() {
        return { error: null }
      },
    },
  }
}
