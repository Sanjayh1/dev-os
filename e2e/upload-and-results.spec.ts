import { expect, test } from '@playwright/test'
import { loginAsSeedUser, resetBackend, SAMPLE_PDF_PATH, uploadAndProcessContract } from './fixtures/flows'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('rejects a non-PDF file client-side before any network call', async ({ page }) => {
  await loginAsSeedUser(page)
  await page.goto('/contracts/new')

  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  })

  await expect(page.getByText('Only PDF files are supported.')).toBeVisible()
})

test('uploads a PDF, adds a custom term, processes it, and lands on the results page', async ({ page }) => {
  await loginAsSeedUser(page)
  await page.goto('/contracts/new')

  await page.locator('input[type="file"]').setInputFiles(SAMPLE_PDF_PATH)
  await page.getByRole('button', { name: 'Upload' }).click()
  await page.getByText(/Standard terms for this/).waitFor()

  await page.getByPlaceholder('e.g. Non-compete radius').fill('Non-compete radius')
  await page.getByRole('button', { name: '+ Add Key Term' }).click()
  await expect(page.getByText('Non-compete radius')).toBeVisible()
  await expect(page.getByText('Custom', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Process Contract' }).click()
  await page.waitForURL('**/contracts/*/results', { timeout: 30_000 })

  await expect(page.getByRole('cell', { name: 'Effective Date' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Governing Law' })).toBeVisible()
})

test('falls back to the text viewer when storage is unavailable, and page clicks scroll it', async ({ page }) => {
  await uploadAndProcessContract(page)

  await expect(page.getByText('PDF preview unavailable')).toBeVisible()
  await page.getByRole('button', { name: '1' }).first().click()
  await expect(page.getByText('Page 1', { exact: true })).toBeVisible()
})
