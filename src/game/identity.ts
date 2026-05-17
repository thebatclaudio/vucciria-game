/**
 * Stable per-(tab, gameCode) player identity.
 *
 * Trystero's `selfId` (the wire-level WebRTC peer id) is regenerated on every
 * page load. That makes it a terrible primary key for application-level state
 * because:
 *
 *   - Player entries in the Yjs `players` map are keyed by player id.
 *   - The Yjs doc is persisted to IndexedDB across reloads.
 *   - On refresh, the old `selfId`-keyed entry is rehydrated AND a new entry
 *     gets created under the fresh `selfId` → the player appears twice.
 *
 * So we generate a stable id per game code and stash it in `sessionStorage`
 * (cleared when the tab closes, survives reloads). Different tabs/windows
 * naturally get different ids, which is the correct semantics — they are
 * different participants from the game's point of view.
 *
 * The Trystero `selfId` is still used internally for WebRTC routing; it just
 * isn't surfaced as an application identifier anywhere.
 */
export function getOrCreatePlayerId(gameCode: string): string {
  const key = `vucciria:playerId:${gameCode}`
  let id = sessionStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(key, id)
  }
  return id
}

/** Read the stable player id for a game code, or null if none exists yet. */
export function readPlayerId(gameCode: string): string | null {
  return sessionStorage.getItem(`vucciria:playerId:${gameCode}`)
}

/** Remove the stable player id for a game code (call on intentional leave). */
export function clearPlayerId(gameCode: string): void {
  sessionStorage.removeItem(`vucciria:playerId:${gameCode}`)
}
