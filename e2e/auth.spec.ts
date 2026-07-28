import { expect, test } from '@playwright/test'
import { resetBackend, SEED_EMAIL, SEED_PASSWORD } from './fixtures/flows'

test.beforeEach(async ({ request }) => {
  await resetBackend(request)
})

test('redirects an unauthenticated visitor away from a protected route', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForURL('**/login')
})

test('blocks login with client-side validation before any network call', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page.getByText('Enter a valid email address')).toBeVisible()
  await expect(page.getByText('Password is required')).toBeVisible()
  // still on /login — no navigation occurred
  expect(page.url()).toContain('/login')
})

test('rejects an incorrect password without revealing which field was wrong', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEED_EMAIL)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page.getByText('Invalid email or password')).toBeVisible()
})

test('logs in an existing user and redirects to the dashboard', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(SEED_EMAIL)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.waitForURL('**/dashboard')
})

test('signs up a new user and redirects to the dashboard', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Email').fill('new-user@test.local')
  await page.getByLabel('Password', { exact: true }).fill('freshpassword123')
  await page.getByLabel('Confirm password').fill('freshpassword123')
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await page.waitForURL('**/dashboard')
})

test('blocks signup when passwords do not match', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Email').fill('mismatch@test.local')
  await page.getByLabel('Password', { exact: true }).fill('freshpassword123')
  await page.getByLabel('Confirm password').fill('somethingelse')
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await expect(page.getByText('Passwords do not match')).toBeVisible()
  expect(page.url()).toContain('/signup')
})
