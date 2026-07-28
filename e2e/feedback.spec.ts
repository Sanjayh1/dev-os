import { expect, test } from '@playwright/test'
import { resetBackend, uploadAndProcessContract } from './fixtures/flows'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('submits thumbs-up feedback with a comment and shows a confirmation', async ({ page }) => {
  await uploadAndProcessContract(page)

  await page.getByRole('button', { name: 'Thumbs up' }).click()
  await page.getByPlaceholder("Anything you'd like to add? (optional)").fill('Great tool, saved me time.')
  await page.getByRole('button', { name: 'Submit feedback' }).click()

  await expect(page.getByText('Thanks for the feedback.')).toBeVisible()
})
