import { test, expect, chromium, type Page, type ConsoleMessage } from '@playwright/test'

// We launch chromium manually (not via the test fixture) so we can have two
// independent BrowserContexts representing two real users. Honor an env var
// for the executable so this works on machines where the bundled Playwright
// Chromium revision isn't installed (e.g. ubuntu26.04 where `playwright
// install` refuses): export PW_EXECUTABLE_PATH=/usr/bin/google-chrome.
const LAUNCH_OPTS = process.env.PW_EXECUTABLE_PATH
  ? { executablePath: process.env.PW_EXECUTABLE_PATH }
  : {}

/**
 * Regression test for the "joiner sees itself as host" bug.
 *
 * Reproduces the exact scenario the user reported:
 *   - Browser A creates a game → should be the only player AND the host.
 *   - Browser B joins with the code →
 *       (a) before P2P sync: should see itself in the player list but NOT as host.
 *       (b) after P2P sync: should see both players, with A marked host and B not.
 *
 * This test also captures all `[room]` console logs from both pages so that
 * when it fails (e.g. peer discovery is blocked on the CI runner), the
 * failure mode is obvious in the test output rather than a generic timeout.
 */

interface PageLogs {
  page: Page
  logs: string[]
}

function attachLogger(page: Page, tag: string): PageLogs {
  const logs: string[] = []
  const onMsg = (msg: ConsoleMessage) => {
    const text = msg.text()
    // Keep noise low: only capture room + lobby diagnostics + errors/warnings.
    if (
      text.includes('[room]') ||
      text.includes('[lobby]') ||
      msg.type() === 'error' ||
      msg.type() === 'warning'
    ) {
      const line = `[${tag}] ${msg.type()}: ${text}`
      logs.push(line)
      // Also stream to the test runner so flakes are debuggable in CI logs.
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
 * Extract who the page CURRENTLY thinks is host by looking for the 👑 marker
 * next to a nickname. Returns the nickname(s) currently flagged as host.
 */
async function getHostNicknames(page: Page): Promise<string[]> {
  // Each player row is an `<li>` containing nickname + optional host badge.
  const rows = await page.locator('ul li').all()
  const hosts: string[] = []
  for (const li of rows) {
    const text = await li.textContent()
    if (!text) continue
    // The host badge contains "👑" or the translated word "host"/"ospite".
    // We look for the crown which is locale-independent.
    if (text.includes('👑')) {
      // Pull the first non-emoji word as the nickname. Player rows render as:
      //   <emoji> <nickname> [(you)] [👑 host]
      // Strip the emojis and badges, keep what's left.
      const cleaned = text
        .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
        .replace(/\(you\)|\(tu\)|host|ospite/gi, '')
        .trim()
      hosts.push(cleaned.split(/\s+/)[0] ?? cleaned)
    }
  }
  return hosts
}

async function getVisibleNicknames(page: Page): Promise<string[]> {
  const rows = await page.locator('ul li').all()
  const names: string[] = []
  for (const li of rows) {
    const text = await li.textContent()
    if (!text) continue
    const cleaned = text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
      .replace(/\(you\)|\(tu\)|host|ospite|Kick|Caccia/gi, '')
      .trim()
    const first = cleaned.split(/\s+/)[0]
    if (first) names.push(first)
  }
  return names
}

test.describe('Host assignment with two peers', () => {
  test('joiner does NOT self-elect as host before peer sync, and host stays with creator after sync', async () => {
    test.setTimeout(90_000)

    const browser = await chromium.launch(LAUNCH_OPTS)
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    const aLogs = attachLogger(pageA, 'A')
    const bLogs = attachLogger(pageB, 'B')

    try {
      // ── Browser A: create profile + game ─────────────────────────────
      await setupProfile(pageA, 'Alice')
      const code = await createGame(pageA)
      console.log(`[test] game code = ${code}`)

      // Alice should immediately be the only player AND the host
      // (her own bootstrap effect runs synchronously after the doc is created).
      await expect(pageA.getByText('Alice')).toBeVisible()
      await expect.poll(() => getHostNicknames(pageA), {
        message: 'Alice should be host on her own page',
        timeout: 10_000,
      }).toEqual(['Alice'])

      // ── Browser B: create profile + join ─────────────────────────────
      await setupProfile(pageB, 'Bob')
      await joinGame(pageB, code)

      // INVARIANT #1: Within ~3s, Bob should see himself in the player list
      //               (self-register is local and synchronous-ish).
      await expect(pageB.getByText('Bob')).toBeVisible({ timeout: 5_000 })

      // INVARIANT #2 (THE BUG): During the pre-sync window, Bob must NEVER
      // appear as host on his own page. Sample multiple times across the
      // first 10 seconds — this is exactly the window where the buggy
      // host-migration effect used to self-elect.
      const samples: string[][] = []
      const sampleStart = Date.now()
      while (Date.now() - sampleStart < 10_000) {
        samples.push(await getHostNicknames(pageB))
        await pageB.waitForTimeout(500)
      }
      const bobEverHost = samples.some((s) => s.includes('Bob'))
      expect(
        bobEverHost,
        `Bob self-elected as host during pre-sync window. Samples: ${JSON.stringify(samples)}`,
      ).toBe(false)

      // ── Wait for P2P sync to bring the two together ──────────────────
      // The MQTT brokers can take up to ~30s; budget generously.
      await expect(pageA.getByText('Bob')).toBeVisible({ timeout: 45_000 })
      await expect(pageB.getByText('Alice')).toBeVisible({ timeout: 45_000 })

      // INVARIANT #3: After sync, BOTH pages agree:
      //   - Alice is the host.
      //   - Bob is NOT the host.
      await expect.poll(() => getHostNicknames(pageA), {
        message: 'After sync, Alice is host on Alice page',
        timeout: 15_000,
      }).toEqual(['Alice'])

      await expect.poll(() => getHostNicknames(pageB), {
        message: 'After sync, Alice is host on Bob page (not Bob himself)',
        timeout: 15_000,
      }).toEqual(['Alice'])

      // Sanity: both lobby views show exactly 2 players.
      await expect.poll(() => getVisibleNicknames(pageA), {
        timeout: 10_000,
      }).toEqual(expect.arrayContaining(['Alice', 'Bob']))
      await expect.poll(() => getVisibleNicknames(pageB), {
        timeout: 10_000,
      }).toEqual(expect.arrayContaining(['Alice', 'Bob']))
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

  test('peer-discovery health check: both pages observe a peer-join event within 45s', async () => {
    // This is a focused liveness probe. If THIS test fails, the problem is
    // not the host-migration logic — it's the P2P transport itself (broker
    // unreachable, NAT issues, etc.). Treat it as a precondition for the
    // host-assignment test above.
    test.setTimeout(90_000)

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
      await setupProfile(pageB, 'Bob')
      await joinGame(pageB, code)

      // Look for `[room] peer joined:` log on BOTH pages.
      await expect.poll(
        () => aLogs.logs.some((l) => l.includes('peer joined:')),
        { message: 'Browser A never observed peer joined', timeout: 60_000 },
      ).toBe(true)

      await expect.poll(
        () => bLogs.logs.some((l) => l.includes('peer joined:')),
        { message: 'Browser B never observed peer joined', timeout: 60_000 },
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
