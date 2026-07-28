// Minimal in-memory stand-in for the subset of the supabase-js query builder
// this app actually uses. Not a general PostgREST reimplementation — just
// enough select/insert/update/delete/eq/order/limit/single/maybeSingle
// semantics to make the real route handlers behave correctly against
// lib/testing/fakeBackendStore's tables during E2E runs.

import { getTables } from './fakeBackendStore'

interface Result {
  data: unknown
  error: { message: string } | null
  count?: number
}

type Row = Record<string, unknown>

function matches(row: Row, filters: Array<[string, unknown]>): boolean {
  return filters.every(([col, val]) => row[col] === val)
}

export function fakeFrom(table: string) {
  const filters: Array<[string, unknown]> = []
  let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: Row | Row[] | null = null
  let returning = false
  let orderCol: string | null = null
  let orderAscending = true
  let limitN: number | null = null
  let wantsCount = false

  function rows(): Row[] {
    const store = getTables()
    return (store[table] ??= [])
  }

  function execute(): { data: Row[] | null; error: { message: string } | null; count?: number } {
    const tableRows = rows()

    if (op === 'insert') {
      const incoming = Array.isArray(payload) ? payload : [payload as Row]
      if (table === 'custom_key_terms') {
        for (const row of incoming) {
          const existingCount = tableRows.filter((r) => r.contract_id === row.contract_id).length
          if (existingCount >= 5) {
            return {
              data: null,
              error: { message: 'max_custom_terms_exceeded: a contract may have at most 5 custom key terms' },
            }
          }
        }
      }
      const inserted = incoming.map((row) => {
        const full = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }
        tableRows.push(full)
        return full
      })
      return { data: returning ? inserted : null, error: null }
    }

    if (op === 'update') {
      const targets = tableRows.filter((row) => matches(row, filters))
      targets.forEach((row) => Object.assign(row, payload))
      return { data: null, error: null }
    }

    if (op === 'delete') {
      const targets = tableRows.filter((row) => matches(row, filters))
      const store = getTables()
      store[table] = tableRows.filter((row) => !targets.includes(row))
      cascadeDelete(table, targets)
      return { data: null, error: null }
    }

    let result = tableRows.filter((row) => matches(row, filters))
    const matchedCount = result.length
    if (orderCol) {
      const col = orderCol
      result = [...result].sort((a, b) => {
        const diff = String(a[col]).localeCompare(String(b[col]))
        return orderAscending ? diff : -diff
      })
    }
    if (limitN != null) result = result.slice(0, limitN)
    return { data: result, error: null, count: wantsCount ? matchedCount : undefined }
  }

  function collapse(mode: 'single' | 'maybeSingle'): Result {
    const { data, error } = execute()
    if (error) return { data: null, error }
    const list = (data as Row[] | null) ?? []
    if (mode === 'single') {
      if (list.length !== 1) return { data: null, error: { message: 'Row not found' } }
      return { data: list[0], error: null }
    }
    return { data: list[0] ?? null, error: null }
  }

  const builder = {
    select(_columns?: string, options?: { count?: 'exact'; head?: boolean }) {
      returning = op === 'insert' ? true : returning
      if (op !== 'insert') op = 'select'
      if (options?.count) wantsCount = true
      return builder
    },
    insert(value: Row | Row[]) {
      op = 'insert'
      payload = value
      return builder
    },
    update(value: Row) {
      op = 'update'
      payload = value
      return builder
    },
    delete() {
      op = 'delete'
      return builder
    },
    eq(col: string, val: unknown) {
      filters.push([col, val])
      return builder
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orderCol = col
      orderAscending = opts?.ascending ?? true
      return builder
    },
    limit(n: number) {
      limitN = n
      return builder
    },
    single(): Promise<Result> {
      return Promise.resolve(collapse('single'))
    },
    maybeSingle(): Promise<Result> {
      return Promise.resolve(collapse('maybeSingle'))
    },
    then(onFulfilled: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) {
      return Promise.resolve(execute()).then(onFulfilled, onRejected)
    },
  }

  return builder
}

function cascadeDelete(table: string, deletedRows: Row[]) {
  if (table !== 'contracts') return
  const store = getTables()
  const contractIds = deletedRows.map((r) => r.id)

  store.key_terms = (store.key_terms ?? []).filter((r) => !contractIds.includes(r.contract_id))
  store.custom_key_terms = (store.custom_key_terms ?? []).filter((r) => !contractIds.includes(r.contract_id))
  store.user_feedback = (store.user_feedback ?? []).filter((r) => !contractIds.includes(r.contract_id))

  const deletedSessions = (store.chat_sessions ?? []).filter((r) => contractIds.includes(r.contract_id))
  store.chat_sessions = (store.chat_sessions ?? []).filter((r) => !contractIds.includes(r.contract_id))
  const sessionIds = deletedSessions.map((s) => s.id)
  store.chat_messages = (store.chat_messages ?? []).filter((r) => !sessionIds.includes(r.session_id))
}
