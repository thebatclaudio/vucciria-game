import { test, expect, chromium, type Page, type ConsoleMessage } from '@playwright/test'

// Honor env override for the Playwright Chromium binary (mirrors the other
// e2e specs in this directory).
const LAUNCH_OPTS = process.env.PW_EXECUTABLE_PATH
  ? { executablePath: process.env.PW_EXECUTABLE_PATH }
  : {}

/**
 * Regression test for the "first turn isn't synchronized" bug.
 *
 * Reported symptom:
 *   Browser 1 draws the card and ends the turn; Browser 2 never sees those
 *   updates until the user manually refreshes Browser 2.
 *
 * Root cause: Lobby and Play were sibling routes in App.tsx. Each route
 * mounted its own `useGameRoom`, which created a fresh Y.Doc + Trystero
 * room binding on mount and tore them down on unmount. When the host
 * clicked "Start game", BOTH browsers navigated `/lobby/:code →
 * /play/:code` and each independently destroyed-and-recreated its room
 * binding at the very moment the first turn began. Trystero (over MQTT)
 * takes seconds-to-minutes to rediscover peers, so the first round of
 * draw/end-turn updates from Browser A never reached Browser B's new
 * room. A manual refresh worked around it because by then peer discovery
 * had settled.
 *
 * Fix: hoist the Y.Doc + Trystero room into a layout-level
 * `GameRoomProvider` that wraps both `/lobby/:code` and `/play/:code`, so
 * the same binding survives the route transition.
 *
 * What this test verifies:
 *   - After the host starts the game and both peers land on /play, the
 *     active peer's first draw is visible on the inactive peer's screen
 *     WITHOUT refreshing.
 *   - After the active peer ends the turn, the inactive peer becomes the
 *     active peer WITHOUT refreshing.
 *
 * This test uses real MQTT brokers (matches the other e2e specs).
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
      text.includes('[play]') ||
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

async function isMyTurn(page: Page): Promise<boolean> {
  const drawBtn = page.getByRole('button', { name: /Draw a card|Pesca una carta/i })
  const endTurnBtn = page.getByRole('button', { name: /End turn|Fine turno/i })
  const drawVisible = await drawBtn.isVisible().catch(() => false)
  const endTurnVisible = await endTurnBtn.isVisible().catch(() => false)
  return drawVisible || endTurnVisible
}

test.describe('First-turn sync across lobby → play transition', () => {
  test('inactive peer sees the active peer\'s draw and end-turn without refreshing', async () => {
    test.setTimeout(180_000)

    const browser = await chromium.launch(LAUNCH_OPTS)
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    const aLogs = attachLogger(pageA, 'A')
    const bLogs = attachLogger(pageB, 'B')

    try {
      await setupProfile(pageA, 'Alice')
      const code = await createGame(pageA)
      console.log(`[test] game code = ${code}`)

      await setupProfile(pageB, 'Bob')
      await joinGame(pageB, code)

      // Lobby is in sync (both visible to each other over Trystero).
      await expect(pageA.getByText('Bob')).toBeVisible({ timeout: 45_000 })
      await expect(pageB.getByText('Alice')).toBeVisible({ timeout: 45_000 })

      // Let the seat-collision heal run.
      await pageA.waitForTimeout(1500)
      await pageB.waitForTimeout(1500)

      // Host starts the game — both navigate to /play.
      const startBtn = pageA.getByRole('button', { name: /Start game|Inizia/i })
      await expect(startBtn).toBeEnabled({ timeout: 10_000 })
      await startBtn.click()
      await pageA.waitForURL(/\/play\//, { timeout: 15_000 })
      await pageB.waitForURL(/\/play\//, { timeout: 15_000 })

      // Identify active peer (whichever one sees the Draw button).
      // Poll up to ~20s for one of them to be active.
      let aActive = false
      let bActive = false
      await expect
        .poll(
          async () => {
            aActive = await isMyTurn(pageA)
            bActive = await isMyTurn(pageB)
            return aActive || bActive
          },
          { timeout: 20_000, message: 'Neither peer became active after game start' },
        )
        .toBe(true)
      expect(aActive !== bActive).toBe(true)

      const activePage = aActive ? pageA : pageB
      const inactivePage = aActive ? pageB : pageA
      const activeName = aActive ? 'Alice' : 'Bob'

      // ── INVARIANT #1: Active peer draws → inactive sees the card ──
      // Before draw: inactive page shows the empty placeholder text.
      // After draw: inactive page should show "X is showing the card" within
      // a few seconds — WITHOUT a refresh. The bug would leave it stuck.
      await activePage
        .getByRole('button', { name: /Draw a card|Pesca una carta/i })
        .click()

      await expect(
        inactivePage.getByText(
          new RegExp(`${activeName} (is showing|sta mostrando)`, 'i'),
        ),
      ).toBeVisible({
        timeout: 15_000,
      })

      // ── INVARIANT #2: Active peer ends turn → inactive becomes active ──
      await activePage
        .getByRole('button', { name: /End turn|Fine turno/i })
        .click()

      await expect
        .poll(
          async () => {
            return await isMyTurn(inactivePage)
          },
          {
            timeout: 15_000,
            message:
              'After end-turn, the previously inactive peer should become active ' +
              'WITHOUT a refresh. If this fails, the first-turn-sync bug has regressed.',
          },
        )
        .toBe(true)

      // And the previously active peer should now be inactive.
      expect(await isMyTurn(activePage)).toBe(false)
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
