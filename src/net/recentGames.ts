/**
 * Recent games index.
 *
 * We persist one IndexedDB database per game code (see `persistence.ts`).
 * Listing "recent games" by enumerating DBs would technically work in
 * Chromium via `indexedDB.databases()`, but Safari has never shipped that
 * API. Instead we maintain a small localStorage index that records the
 * (code, name, lastSeenAt) triple for every game the local profile has
 * successfully bound to.
 *
 * Why localStorage and not the Y.Doc itself: this index is a per-device
 * cache, not part of the shared CRDT state. Keeping it out of the doc
 * also means a kicked / left player still sees the game in their
 * "Recent" list and can rejoin via the Dashboard with one tap.
 *
 * Trimmed to the most recent N entries (default 8) so the storage cost
 * stays bounded even after months of use.
 */

const STORAGE_KEY = 'vucciria:recentGames:v1'
const MAX_ENTRIES = 8

export type RecentGame = {
  code: string
  /** Human-readable name set at creation time. May be empty until meta syncs. */
  name: string
  /** ms since epoch — used to sort newest-first. */
  lastSeenAt: number
}

function read(): RecentGame[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Defensive: filter any malformed rows so a corrupt entry can't break
    // the dashboard for the user.
    return parsed.filter(
      (e): e is RecentGame =>
        !!e &&
        typeof e === 'object' &&
        typeof (e as RecentGame).code === 'string' &&
        typeof (e as RecentGame).name === 'string' &&
        typeof (e as RecentGame).lastSeenAt === 'number',
    )
  } catch {
    return []
  }
}

function write(list: RecentGame[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* quota / private mode — ignore */
  }
}

/**
 * Record (or refresh) a game in the recent-games list. If `code` is
 * already present, its `name` and `lastSeenAt` are updated and the row
 * floats to the top.
 */
export function recordRecentGame(code: string, name: string): void {
  const trimmedName = name.trim()
  const now = Date.now()
  const existing = read().filter((e) => e.code !== code)
  const next: RecentGame[] = [
    { code, name: trimmedName, lastSeenAt: now },
    ...existing,
  ].slice(0, MAX_ENTRIES)
  write(next)
}

/** Remove a game from the recent list (e.g. after game-over cleanup). */
export function forgetRecentGame(code: string): void {
  write(read().filter((e) => e.code !== code))
}

/** Return the recent games newest-first. */
export function listRecentGames(): RecentGame[] {
  return read().sort((a, b) => b.lastSeenAt - a.lastSeenAt)
}
