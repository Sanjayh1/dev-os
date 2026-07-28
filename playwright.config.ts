import { defineConfig, devices } from '@playwright/test'

// All E2E specs share one in-memory fake backend (see lib/testing/) running
// inside a single dev server process — see e2e/fixtures/reset.ts for why
// workers are pinned to 1.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    // A production build removes next dev's on-demand per-route compilation,
    // which was adding enough latency on a route's first hit to occasionally
    // blow past assertion timeouts — a test-environment artifact, not a real
    // app slowdown. NEXT_PUBLIC_E2E_MOCK_BACKEND must be set for the build
    // step too, since NEXT_PUBLIC_ vars are inlined into the client bundle
    // at build time, not read at request time.
    command: 'npm run build && npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_E2E_MOCK_BACKEND: '1',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
