import { vi } from 'vitest'

// Minimal fake matching the chainable subset of the supabase-js query builder
// that our routes actually use (.select/.insert/.update/.delete/.eq/.order/
// .limit/.single/.maybeSingle, plus being directly awaitable). Results are
// queued per table in call order; once a table's queue is down to one entry
// it keeps returning that entry (covers routes that call the same table
// again for a status update we don't assert on).

export interface TableResult {
  data: unknown
  error: unknown
}

export interface SupabaseMockConfig {
  user?: { id: string } | null
  tableResults?: Record<string, TableResult | TableResult[]>
  storageUpload?: { data: unknown; error: unknown }
  storageSignedUrl?: { data: { signedUrl: string } | null; error: unknown }
}

export function createMockSupabaseClient(config: SupabaseMockConfig = {}) {
  const queues: Record<string, TableResult[]> = {}
  for (const [table, result] of Object.entries(config.tableResults ?? {})) {
    queues[table] = Array.isArray(result) ? [...result] : [result]
  }

  function resolveFor(table: string): TableResult {
    const queue = queues[table]
    if (!queue || queue.length === 0) return { data: null, error: null }
    return queue.length > 1 ? queue.shift()! : queue[0]
  }

  function from(table: string) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = vi.fn(chain)
    builder.insert = vi.fn(chain)
    builder.update = vi.fn(chain)
    builder.delete = vi.fn(chain)
    builder.eq = vi.fn(chain)
    builder.order = vi.fn(chain)
    builder.limit = vi.fn(chain)
    builder.single = vi.fn(() => Promise.resolve(resolveFor(table)))
    builder.maybeSingle = vi.fn(() => Promise.resolve(resolveFor(table)))
    builder.then = (onFulfilled: (v: TableResult) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolveFor(table)).then(onFulfilled, onRejected)
    return builder
  }

  return {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: config.user ?? null } })),
    },
    from: vi.fn(from),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve(config.storageUpload ?? { data: { path: 'x' }, error: null })),
        createSignedUrl: vi.fn(() =>
          Promise.resolve(
            config.storageSignedUrl ?? { data: { signedUrl: 'https://signed.example/file.pdf' }, error: null }
          )
        ),
        remove: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    },
  }
}
