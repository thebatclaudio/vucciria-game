import { test, expect, chromium } from '@playwright/test'

/**
 * Smoke test: two browser contexts simulate two peers joining the same lobby.
 *
 * NOTE: This test depends on Trystero's default Nostr relays being reachable
 * from the CI runner. If flaky in CI, swap the strategy to a self-hosted
 * ws-relay in `src/net/room.ts` and run that relay alongside the test.
 */
test('two peers can see each other in lobby', async () => {
  test.setTimeout(60_000)
  const browser = await chromium.launch()

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  // Peer A: create profile and create game
  await pageA.goto('/')
  await pageA.getByPlaceholder(/nickname/i).fill('Alice')
  await pageA.getByLabel(/^Pick /).first().click()
  await pageA.getByRole('button', { name: /play/i }).click()
  await pageA.getByRole('button', { name: /create/i }).click()
  await pageA.getByRole('button', { name: /^Create$|^Crea$/i }).click()

  // Read the 6-char code from the lobby
  await pageA.waitForURL(/\/lobby\//)
  const url = new URL(pageA.url())
  const code = url.pathname.split('/').pop()!
  expect(code).toHaveLength(6)

  // Peer B: create profile and join with code
  await pageB.goto('/')
  await pageB.getByPlaceholder(/nickname/i).fill('Bob')
  await pageB.getByLabel(/^Pick /).first().click()
  await pageB.getByRole('button', { name: /play/i }).click()
  await pageB.getByRole('button', { name: /join/i }).click()
  await pageB.locator('input[maxlength="6"]').fill(code)
  await pageB.getByRole('button', { name: /^Join$|^Entra$/i }).click()
  await pageB.waitForURL(/\/lobby\//)

  // Both should eventually see "Bob" in Alice's lobby (sync over Trystero)
  await expect(pageA.getByText('Bob')).toBeVisible({ timeout: 30_000 })
  await expect(pageB.getByText('Alice')).toBeVisible({ timeout: 30_000 })

  await browser.close()
})
