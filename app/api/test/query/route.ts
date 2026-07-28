import { NextResponse, type NextRequest } from 'next/server'
import { fakeFrom } from '@/lib/testing/fakeQueryBuilder'
import { SESSION_COOKIE_NAME } from '@/lib/testing/fakeBackendStore'

// E2E-only: backs the fake browser client's `.from()` (used by pages that
// query Supabase directly client-side, e.g. the dashboard — no dedicated API
// route per docs/specs/dashboard.md). Auto-scopes to the current session's
// user_id, mirroring what RLS does for real reads. 404s outside E2E mock mode.
export async function POST(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const userId = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!userId) {
    return NextResponse.json({ data: null, error: { message: 'Not authenticated' } })
  }

  const body = await request.json().catch(() => null)
  const table = typeof body?.table === 'string' ? body.table : null
  if (!table) {
    return NextResponse.json({ data: null, error: { message: 'table is required' } })
  }

  let query = fakeFrom(table).select('*', body.count ? { count: 'exact', head: !!body.head } : undefined)
  query = query.eq('user_id', userId)

  const filters = Array.isArray(body.filters) ? (body.filters as Array<[string, unknown]>) : []
  for (const [col, val] of filters) {
    query = query.eq(col, val)
  }
  if (body.order) query = query.order(body.order.column, { ascending: body.order.ascending })
  if (typeof body.limit === 'number') query = query.limit(body.limit)

  const result = await query
  return NextResponse.json(result)
}
