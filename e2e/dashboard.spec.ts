import { expect, test } from '@playwright/test'
import { loginAsSeedUser, resetBackend, uploadAndProcessContract } from './fixtures/flows'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('shows the empty state for a user with no contracts', async ({ page }) => {
  await loginAsSeedUser(page)
  await expect(page.getByText('No contracts reviewed yet')).toBeVisible()
})

test('shows a processed contract in the summary and history table, and rows navigate to results', async ({
  page,
}) => {
  const contractId = await uploadAndProcessContract(page)

  await page.goto('/dashboard')
  await expect(page.getByText('Total contracts')).toBeVisible()

  const row = page.getByRole('row', { name: /sample-contract\.pdf/ })
  await expect(row).toBeVisible()
  await expect(row.getByText('Completed', { exact: true })).toBeVisible()

  await row.click()
  await page.waitForURL(`**/contracts/${contractId}/results`)
})

test('sorting the history table by name toggles direction on repeated clicks', async ({ page }) => {
  await uploadAndProcessContract(page)
  await page.goto('/dashboard')

  const nameHeader = page.getByRole('button', { name: 'Name' })
  await nameHeader.click()
  await expect(page.getByText('↑')).toBeVisible()
  await nameHeader.click()
  await expect(page.getByText('↓')).toBeVisible()
})
