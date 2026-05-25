import { test, expect } from '@playwright/test'

/**
 * Regression: scanning a lobby QR code should land the user in that
 * lobby, even when the device has no saved profile yet.
 *
 * Two contracts this test pins:
 *
 *   1. The deep-link URL format the QR code encodes (`/lobby/{code}`,
 *      a real pathname under BrowserRouter) actually resolves to the
 *      lobby route. An earlier revision encoded `/#/lobby/...` which
 *      BrowserRouter silently dropped — the user ended up at `/`.
 *
 *   2. After the profile gate (nickname + emoji), the user lands in
 *      the requested lobby, not on `/dashboard`. RequireProfile
 *      preserves the original Location via Navigate state; Home reads
 *      it back and navigates accordingly.
 *
 * We intentionally use a code that no other peer is in. The lobby will
 * sit in "Connecting to P2P network" forever, but the URL + heading
 * are enough to prove the routing contract.
 */
test('QR deep-link survives the profile gate', async ({ page }) => {
  // Cold-start: ensure no persisted profile from a previous test.
  await page.context().clearCookies()
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.removeItem('vucciria:profile')
  })

  const deepLink = '/lobby/ABCDEF'
  await page.goto(deepLink)

  // The profile gate should have bounced us to Home, NOT shown the
  // lobby yet — Home is recognisable by the nickname input.
  await expect(page.getByPlaceholder(/nickname/i)).toBeVisible()
  expect(new URL(page.url()).pathname).not.toMatch(/\/lobby\//)

  // Complete the profile. Home pre-fills nickname + emoji on mount,
  // so a single click on Play is enough for `canPlay` to be true.
  await page.getByRole('button', { name: /play/i }).click()

  // After submit, we must be back at the original deep-link, not at
  // /dashboard.
  await page.waitForURL(/\/lobby\/ABCDEF$/, { timeout: 5_000 })
  expect(new URL(page.url()).pathname).toMatch(/\/lobby\/ABCDEF$/)
})

test('QR deep-link is a no-op when profile already exists', async ({
  page,
}) => {
  // Seed a profile so RequireProfile lets us straight through.
  await page.goto('/')
  await page.evaluate(() => {
    window.localStorage.setItem(
      'vucciria:profile',
      JSON.stringify({
        state: { profile: { nickname: 'Tester', emoji: '😀' } },
        version: 0,
      }),
    )
  })

  await page.goto('/lobby/ABCDEF')
  await page.waitForURL(/\/lobby\/ABCDEF$/, { timeout: 5_000 })

  // Home form should NOT be on the page.
  await expect(page.getByPlaceholder(/nickname/i)).toHaveCount(0)
})
