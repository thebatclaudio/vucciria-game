import { test, expect, chromium, type Page, type ConsoleMessage } from '@playwright/test'

// Manual chromium launch so we can have two independent BrowserContexts
// representing two real users. Honor PW_EXECUTABLE_PATH for systems where
// `playwright install` doesn't work (e.g. ubuntu26.04).
const LAUNCH_OPTS = process.env.PW_EXECUTABLE_PATH
  ? { executablePath: process.env.PW_EXECUTABLE_PATH }
  : {}

/**
 * Regression test for the "both players see 'Your turn'" bug.
 *
 * Root cause (now fixed): both the host and a joiner could independently
 * compute `nextSeat = 0` before P2P sync arrived, landing two distinct
 * playerIds at the same `seat`. When the game started, `meta.turnSeat=0`
 * matched BOTH players, so both saw "Your turn — draw a card" and both
 * had the draw button.
 *
 * The fix: in Lobby.tsx, a healing effect detects seat collisions and the
 * lex-larger peerId reassigns to `max(seat)+1`. This runs only after
 * `peerCount > 0` so we don't preemptively yield to a peer that isn't there.
 *
 * What this test verifies once the game has started:
 *   1. Exactly ONE peer at a time sees "Your turn" / the draw button.
 *   2. The OTHER peer sees a "waiting for X" message and no draw button.
 *   3. After the active peer draws a card, the card is visible to both.
 *   4. After the active peer ends their turn, the turn flips to the other.
 */

interface PageLogs {
  page: Page
  logs: string[]
}

function attachLogger(page: Page, tag: string): PageLogs {
  const logs: string[] = []
  const onMsg = (msg: ConsoleMessage) => {
    const text = msg.text()
    if (
      text.includes('[room]') ||
      text.includes('[lobby]') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      const line = `[${tag}] ${msg.type()}: ${text}`
      logs.push(line)
      console.log(line)
    }
  }
  page.on('console', onMsg)
  page.on('pageerror', (err) => {
    const line = `[${tag}] pageerror: ${err.message}`
    logs.push(line)
    console.log(line)
  })
  return { page, logs }
}

async function setupProfile(page: Page, nickname: string) {
  await page.goto('/')
  await page.getByPlaceholder(/nickname/i).fill(nickname)
  await page.getByLabel(/^Pick /).first().click()
  await page.getByRole('button', { name: /^Play$|^Gioca$/i }).click()
  await expect(page.getByRole('heading', { name: /Welcome|Benvenuto/i })).toBeVisible()
}

async function createGame(page: Page): Promise<string> {
  await page.getByRole('button', { name: /create/i }).click()
  await page.getByRole('button', { name: /^Create$|^Crea$/i }).click()
  await page.waitForURL(/\/lobby\//)
  const code = new URL(page.url()).pathname.split('/').pop()!
  expect(code).toHaveLength(6)
  return code
}

async function joinGame(page: Page, code: string) {
  await page.getByRole('button', { name: /join/i }).click()
  await page.locator('input[maxlength="6"]').fill(code)
  await page.getByRole('button', { name: /^Join$|^Entra$/i }).click()
  await page.waitForURL(/\/lobby\//)
}

/**
 * Check whether a page is showing the "it's my turn" UI (= active player).
 * We match on the draw button visibility, which is the source of truth.
 */
async function isMyTurn(page: Page): Promise<boolean> {
  // Draw button is rendered ONLY for the active player in awaiting-draw phase.
  // End-turn button is rendered ONLY for the active player in card-revealed phase.
  // Either being visible means "it's my turn."
  const drawBtn = page.getByRole('button', { name: /Draw a card|Pesca una carta/i })
  const endTurnBtn = page.getByRole('button', { name: /End turn|Fine turno/i })
  const drawVisible = await drawBtn.isVisible().catch(() => false)
  const endTurnVisible = await endTurnBtn.isVisible().catch(() => false)
  return drawVisible || endTurnVisible
}

test.describe('Turn mechanics with two peers', () => {
  test('exactly one peer at a time is active; turn flips correctly on end-turn', async () => {
    test.setTimeout(120_000)

    const browser = await chromium.launch(LAUNCH_OPTS)
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    const aLogs = attachLogger(pageA, 'A')
    const bLogs = attachLogger(pageB, 'B')

    try {
      // ── Setup: two profiles, lobby with both peers connected ───────────
      await setupProfile(pageA, 'Alice')
      const code = await createGame(pageA)
      console.log(`[test] game code = ${code}`)

      await setupProfile(pageB, 'Bob')
      await joinGame(pageB, code)

      // Wait for both peers to see each other (P2P sync over MQTT)
      await expect(pageA.getByText('Bob')).toBeVisible({ timeout: 45_000 })
      await expect(pageB.getByText('Alice')).toBeVisible({ timeout: 45_000 })

      // Give the seat-collision heal a moment to run (it depends on peerCount > 0)
      await pageA.waitForTimeout(1500)
      await pageB.waitForTimeout(1500)

      // ── Start the game ─────────────────────────────────────────────────
      // Alice is the host (verified by host-bug.spec.ts).
      const startBtn = pageA.getByRole('button', { name: /Start game|Inizia/i })
      await expect(startBtn).toBeEnabled({ timeout: 10_000 })
      await startBtn.click()

      // Both pages should navigate to /play/<code>
      await pageA.waitForURL(/\/play\//, { timeout: 15_000 })
      await pageB.waitForURL(/\/play\//, { timeout: 15_000 })

      // ── INVARIANT #1: Exactly ONE peer is active ───────────────────────
      // Poll for stable state — give Yjs a moment to fully sync.
      await expect.poll(
        async () => {
          const a = await isMyTurn(pageA)
          const b = await isMyTurn(pageB)
          // Return both as a tuple for diagnostic visibility on failure
          return { aActive: a, bActive: b }
        },
        {
          message:
            'After game start, exactly ONE peer should be active. ' +
            'If both show as active, the seat-collision bug has regressed.',
          timeout: 20_000,
        },
      ).toEqual(
        expect.objectContaining({
          // XOR: exactly one is true
          aActive: expect.any(Boolean),
          bActive: expect.any(Boolean),
        }),
      )

      // Now check the XOR property explicitly
      const aActive = await isMyTurn(pageA)
      const bActive = await isMyTurn(pageB)
      expect(
        aActive !== bActive,
        `Expected exactly one active player, got A=${aActive} B=${bActive}. ` +
          `This is the "both see Your turn" bug.`,
      ).toBe(true)

      // ── INVARIANT #2: Inactive peer sees the waiting message ───────────
      const activePage = aActive ? pageA : pageB
      const inactivePage = aActive ? pageB : pageA
      const activeName = aActive ? 'Alice' : 'Bob'

      // The inactive page should show "Waiting for <active> to draw"
      await expect(
        inactivePage.getByText(new RegExp(`(Waiting for|Aspettando che) ${activeName}`, 'i')),
      ).toBeVisible({ timeout: 10_000 })

      // Inactive page should NOT have a draw button
      await expect(
        inactivePage.getByRole('button', { name: /Draw a card|Pesca una carta/i }),
      ).toHaveCount(0)

      // ── INVARIANT #3: Drawing a card reveals it to both peers ──────────
      await activePage
        .getByRole('button', { name: /Draw a card|Pesca una carta/i })
        .click()

      // Active page now shows "End turn" button (card-revealed phase)
      await expect(
        activePage.getByRole('button', { name: /End turn|Fine turno/i }),
      ).toBeVisible({ timeout: 10_000 })

      // Inactive page should see "X is showing the card"
      await expect(
        inactivePage.getByText(
          new RegExp(`${activeName} (is showing|sta mostrando)`, 'i'),
        ),
      ).toBeVisible({ timeout: 15_000 })

      // Inactive page should still NOT have draw or end-turn buttons
      await expect(
        inactivePage.getByRole('button', { name: /Draw a card|Pesca una carta/i }),
      ).toHaveCount(0)
      await expect(
        inactivePage.getByRole('button', { name: /End turn|Fine turno/i }),
      ).toHaveCount(0)

      // ── INVARIANT #4: End turn flips active player ─────────────────────
      await activePage.getByRole('button', { name: /End turn|Fine turno/i }).click()

      // Within a few seconds, roles should swap.
      await expect.poll(
        async () => {
          const a = await isMyTurn(pageA)
          const b = await isMyTurn(pageB)
          return { aActive: a, bActive: b }
        },
        {
          message: 'After end turn, the other peer should become active',
          timeout: 15_000,
        },
      ).toEqual({ aActive: !aActive, bActive: !bActive })

      // Sanity: re-check XOR after the flip
      const aActive2 = await isMyTurn(pageA)
      const bActive2 = await isMyTurn(pageB)
      expect(
        aActive2 !== bActive2,
        `After end-turn, expected exactly one active player, got A=${aActive2} B=${bActive2}`,
      ).toBe(true)
    } catch (err) {
      console.log('\n──── A logs ────')
      aLogs.logs.forEach((l) => console.log(l))
      console.log('\n──── B logs ────')
      bLogs.logs.forEach((l) => console.log(l))
      throw err
    } finally {
      await browser.close()
    }
  })
})
