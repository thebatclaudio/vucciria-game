import { describe, it, expect } from 'vitest'
import {
  orderedPlayers,
  alivePlayers,
  nextTurnSeat,
  checkWinner,
  aliveNeighbors,
} from '@/game/rules'
import type { Player } from '@/game/types'

const mk = (seat: number, lives = 3, id = `p${seat}`): Player => ({
  peerId: id,
  nickname: `Player${seat}`,
  emoji: '🧑',
  lives,
  seat,
  joinedAt: seat * 1000,
})

describe('rules', () => {
  it('orderedPlayers sorts by seat', () => {
    expect(orderedPlayers([mk(2), mk(0), mk(1)]).map((p) => p.seat)).toEqual([0, 1, 2])
  })

  it('alivePlayers filters out lives === 0', () => {
    expect(alivePlayers([mk(0, 0), mk(1, 2), mk(2, 0)]).map((p) => p.seat)).toEqual([1])
  })

  it('nextTurnSeat wraps around and skips dead players', () => {
    const players = [mk(0, 3), mk(1, 0), mk(2, 1), mk(3, 0)]
    expect(nextTurnSeat(players, 0)).toBe(2)
    expect(nextTurnSeat(players, 2)).toBe(0)
  })

  it('nextTurnSeat returns -1 if no one alive', () => {
    expect(nextTurnSeat([mk(0, 0), mk(1, 0)], 0)).toBe(-1)
  })

  it('checkWinner returns sole survivor', () => {
    const w = checkWinner([mk(0, 0), mk(1, 2), mk(2, 0)])
    expect(w?.seat).toBe(1)
  })

  it('checkWinner returns null when >1 alive', () => {
    expect(checkWinner([mk(0, 1), mk(1, 1)])).toBeNull()
  })

  it('aliveNeighbors returns left and right alive peers', () => {
    const players = [mk(0), mk(1), mk(2), mk(3)]
    const n = aliveNeighbors(players, 1)
    expect(n.left?.seat).toBe(0)
    expect(n.right?.seat).toBe(2)
  })

  it('aliveNeighbors wraps around', () => {
    const players = [mk(0), mk(1), mk(2)]
    const n = aliveNeighbors(players, 0)
    expect(n.left?.seat).toBe(2)
    expect(n.right?.seat).toBe(1)
  })
})
