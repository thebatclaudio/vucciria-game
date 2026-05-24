import type { Player } from './types'

/** Players sorted by seat ascending. */
export function orderedPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.seat - b.seat)
}

/** Players still in the game (lives > 0), in seat order. */
export function alivePlayers(players: Player[]): Player[] {
  return orderedPlayers(players).filter((p) => p.lives > 0)
}

/**
 * Given the current player's seat, find the seat of the next alive player.
 * Returns -1 if no one is alive.
 */
export function nextTurnSeat(players: Player[], currentSeat: number): number {
  const order = orderedPlayers(players)
  if (order.length === 0) return -1
  const startIdx = Math.max(
    0,
    order.findIndex((p) => p.seat === currentSeat),
  )
  for (let i = 1; i <= order.length; i++) {
    const p = order[(startIdx + i) % order.length]
    if (p.lives > 0) return p.seat
  }
  return -1
}

/**
 * Did the game end? Returns the winner or null.
 *
 * A winner is declared when exactly one player is still alive AND the game
 * was started with more than one player. The starting count is passed
 * explicitly so that players leaving or being kicked mid-game can't shrink
 * the total below the alive count and thereby suppress the win condition
 * (see https://github.com/.../issues — the v1 bug where the sole survivor
 * was stuck forever because `players.length === alive.length === 1`).
 *
 * Fallback: if `startingPlayerCount` is 0 (unknown — e.g. doc created
 * before this field existed), use a heuristic: declare a winner if at
 * least one player has already died (lives <= 0) OR the players array
 * itself is larger than 1.
 */
export function checkWinner(
  players: Player[],
  startingPlayerCount = 0,
): Player | null {
  const alive = alivePlayers(players)
  if (alive.length !== 1) return null
  if (startingPlayerCount > 1) return alive[0]
  if (startingPlayerCount === 0) {
    // Best-effort fallback for legacy/rehydrated docs.
    const someoneDied = players.some((p) => p.lives <= 0)
    if (someoneDied || players.length > 1) return alive[0]
  }
  return null
}

/**
 * Return the left and right neighbors (seat-wise) of a given player among
 * the alive players. Used by the "Tre dell'Ave Maria" card.
 */
export function aliveNeighbors(
  players: Player[],
  seat: number,
): { left: Player | null; right: Player | null } {
  const alive = alivePlayers(players)
  if (alive.length < 2) return { left: null, right: null }
  const idx = alive.findIndex((p) => p.seat === seat)
  if (idx === -1) return { left: null, right: null }
  const left = alive[(idx - 1 + alive.length) % alive.length]
  const right = alive[(idx + 1) % alive.length]
  return { left, right }
}

/**
 * Deterministic seat-collision resolver.
 *
 * Background: peers self-register their player entry BEFORE P2P sync
 * completes (so the local lobby UI feels responsive). This means two peers
 * can independently compute `nextSeat = 0` and both land at seat 0. The
 * visible bug is "both players see 'Your turn' once the game starts."
 *
 * This pure function decides what `myself` should do given the full list
 * of players (post-sync). It returns:
 *   - `null`: no action needed (no collision, or I won the lex tiebreaker).
 *   - `number`: my new seat. The caller should write this into the Y.Map.
 *
 * Resolution policy:
 *   1. Find all players sharing my current seat.
 *   2. If only me, no-op.
 *   3. Otherwise, lex-smallest `peerId` among colliders keeps the seat;
 *      every other colliding player picks `max(allSeats) + 1`.
 *
 * Idempotent: running this repeatedly converges. Two losers racing to the
 * same `max+1` will collide too — but the next pass will resolve that one
 * the same way (lex-smallest keeps, the other moves to max+1 again). So
 * eventual consistency holds, with at most N passes for N colliders.
 *
 * Deterministic across peers: every peer computes the same winner from the
 * same player list, so Yjs writes are consistent.
 */
export function resolveSeatCollision(
  players: Player[],
  myPeerId: string,
): number | null {
  const me = players.find((p) => p.peerId === myPeerId)
  if (!me) return null
  const colliders = players.filter((p) => p.seat === me.seat)
  if (colliders.length < 2) return null
  const winner = [...colliders].sort((a, b) => a.peerId.localeCompare(b.peerId))[0]
  if (winner.peerId === myPeerId) return null
  const maxSeat = players.reduce((m, p) => Math.max(m, p.seat), -1)
  return maxSeat + 1
}
