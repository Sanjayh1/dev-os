import path from 'path'
import type { APIRequestContext, Page } from '@playwright/test'

export const SEED_EMAIL = 'e2e@test.local'
export const SEED_PASSWORD = 'password123'
export const SAMPLE_PDF_PATH = path.join(__dirname, 'sample-contract.pdf')

export async function resetBackend(request: APIRequestContext) {
  const response = await request.post('/api/test/reset')
  if (!response.ok()) {
    throw new Error(`Failed to reset E2E backend: ${response.status()}`)
  }
}

export async function loginAsSeedUser(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEED_EMAIL)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.waitForURL('**/dashboard')
}

/** Logs in, uploads the sample PDF as an NDA, and processes it. Returns the contract id. */
export async function uploadAndProcessContract(page: Page): Promise<string> {
  await loginAsSeedUser(page)
  await page.goto('/contracts/new')

  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF_PATH)
  await page.getByRole('button', { name: 'Upload' }).click()
  await page.getByText(/Standard terms for this/).waitFor()

  await page.getByRole('button', { name: 'Process Contract' }).click()
  await page.waitForURL('**/contracts/*/results', { timeout: 30_000 })

  const match = page.url().match(/\/contracts\/([^/]+)\/results/)
  if (!match) throw new Error(`Could not extract contract id from URL: ${page.url()}`)
  return match[1]
}
