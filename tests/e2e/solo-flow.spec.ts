import { test, expect } from '@playwright/test'

test('Home → Dashboard with nickname + emoji', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /VucciriaGame/i })).toBeVisible()

  await page.getByPlaceholder(/nickname/i).fill('Tester')
  // Pick the first available emoji button
  await page.getByLabel(/^Pick /).first().click()

  await page.getByRole('button', { name: /play/i }).click()

  await expect(page.getByRole('heading', { name: /Welcome|Benvenuto/i })).toBeVisible()
})

test('Dashboard → Join with invalid code stays put', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder(/nickname/i).fill('Tester')
  await page.getByLabel(/^Pick /).first().click()
  await page.getByRole('button', { name: /play/i }).click()

  await page.getByRole('button', { name: /join/i }).click()
  await expect(page.getByPlaceholder('ABC123')).toBeVisible()
})
