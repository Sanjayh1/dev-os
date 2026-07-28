import { NextResponse } from 'next/server'
import { resetFakeBackend } from '@/lib/testing/fakeBackendStore'

// E2E-only: gives each Playwright spec file a clean in-memory backend.
// 404s outside E2E mock mode so this never exists as a real surface.
export async function POST() {
  if (process.env.NEXT_PUBLIC_E2E_MOCK_BACKEND !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  resetFakeBackend()
  return NextResponse.json({ ok: true })
}
