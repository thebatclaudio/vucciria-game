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

/** Did the game end? Returns the winner or null. */
export function checkWinner(players: Player[]): Player | null {
  const alive = alivePlayers(players)
  if (alive.length === 1 && players.length > 1) return alive[0]
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
