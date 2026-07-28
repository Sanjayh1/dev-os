import { expect, test } from '@playwright/test'
import { resetBackend, uploadAndProcessContract } from './fixtures/flows'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('editing a key term value shows an Edited badge and persists across reload', async ({ page }) => {
  await uploadAndProcessContract(page)

  const row = page.getByRole('row', { name: /Effective Date/ })
  await row.getByRole('button', { name: 'Edit value' }).click()
  const input = row.locator('input')
  await input.fill('March 3, 2025')
  await input.press('Enter')

  await expect(row.getByText('March 3, 2025')).toBeVisible()
  await expect(row.getByText('Edited')).toBeVisible()

  await page.reload()
  const reloadedRow = page.getByRole('row', { name: /Effective Date/ })
  await expect(reloadedRow.getByText('March 3, 2025')).toBeVisible()
  await expect(reloadedRow.getByText('Edited')).toBeVisible()
})

test('canceling an edit with Escape leaves the original value untouched', async ({ page }) => {
  await uploadAndProcessContract(page)

  const row = page.getByRole('row', { name: /Governing Law/ })
  await row.getByRole('button', { name: 'Edit value' }).click()
  const input = row.locator('input')
  await input.fill('Should not be saved')
  await input.press('Escape')

  await expect(row.getByText('State of Delaware')).toBeVisible()
  await expect(row.getByText('Should not be saved')).not.toBeVisible()
})

test('sends a chat message and renders a grounded reply with a page citation and source attribution', async ({
  page,
}) => {
  await uploadAndProcessContract(page)

  await page.getByRole('button', { name: 'Chat with Contract' }).click()
  await page.getByPlaceholder('Ask about this contract…').fill('What is the governing law?')
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.getByText(/Based on the document/)).toBeVisible()
  await expect(page.getByRole('button', { name: '[Page 1]' })).toBeVisible()
  // First-ever message with no prior history is always classified 'contract'.
  await expect(page.getByText('Source: Contract', { exact: true })).toBeVisible()

  // Attribution is persisted (chat_messages.context_type), not just shown for
  // the live turn — reopen the panel after a reload and it must still be there.
  await page.reload()
  await page.getByRole('button', { name: 'Chat with Contract' }).click()
  await expect(page.getByText('Source: Contract', { exact: true })).toBeVisible()
})
