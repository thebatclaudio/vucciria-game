import { describe, it, expect } from 'vitest'
import {
  orderedPlayers,
  alivePlayers,
  nextTurnSeat,
  checkWinner,
  aliveNeighbors,
  resolveSeatCollision,
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

const mkId = (id: string, seat: number, lives = 3): Player => ({
  peerId: id,
  nickname: id,
  emoji: '🧑',
  lives,
  seat,
  joinedAt: 0,
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

  it('checkWinner returns sole survivor (3 starting, 1 dead, 1 left)', () => {
    // Heuristic path: no startingPlayerCount provided, but at least one
    // player has died → declare the sole survivor.
    const w = checkWinner([mk(0, 0), mk(1, 2), mk(2, 0)])
    expect(w?.seat).toBe(1)
  })

  it('checkWinner returns null when >1 alive', () => {
    expect(checkWinner([mk(0, 1), mk(1, 1)])).toBeNull()
  })

  it('checkWinner with startingPlayerCount declares winner when losers left', () => {
    // 3-player game started. Two players left the room (so their entries
    // are gone). Only the sole survivor remains. Without startingPlayerCount,
    // checkWinner would see alive.length === 1 && players.length === 1 and
    // fail the legacy `players.length > 1` guard. With startingPlayerCount,
    // the win still fires.
    const remaining = [mk(0, 2)]
    expect(checkWinner(remaining, 3)?.seat).toBe(0)
  })

  it('checkWinner returns null in a 1-player game', () => {
    // startingPlayerCount === 1 (solo lobby): never declare a winner.
    const players = [mk(0, 2)]
    expect(checkWinner(players, 1)).toBeNull()
  })

  it('checkWinner unknown startingCount + no deaths + 1 player → null', () => {
    // Defensive: legacy doc with one entry and no deaths → still null.
    const players = [mk(0, 2)]
    expect(checkWinner(players)).toBeNull()
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

describe('resolveSeatCollision', () => {
  it('returns null when there is no collision', () => {
    const players = [mkId('alice', 0), mkId('bob', 1)]
    expect(resolveSeatCollision(players, 'alice')).toBeNull()
    expect(resolveSeatCollision(players, 'bob')).toBeNull()
  })

  it('returns null when the player is unknown', () => {
    const players = [mkId('alice', 0)]
    expect(resolveSeatCollision(players, 'nobody')).toBeNull()
  })

  it('lex-smallest peerId keeps the seat', () => {
    // alice < bob lexicographically; both at seat 0
    const players = [mkId('alice', 0), mkId('bob', 0)]
    expect(resolveSeatCollision(players, 'alice')).toBeNull()
  })

  it('lex-larger peerId yields and gets max(seat)+1', () => {
    // alice < bob; both at seat 0; max seat is 0, so bob → seat 1
    const players = [mkId('alice', 0), mkId('bob', 0)]
    expect(resolveSeatCollision(players, 'bob')).toBe(1)
  })

  it('yields to the highest existing seat + 1, not just colliders', () => {
    // alice + bob collide at seat 0; carol is at seat 5 already
    // → bob must go to seat 6, not seat 1
    const players = [mkId('alice', 0), mkId('bob', 0), mkId('carol', 5)]
    expect(resolveSeatCollision(players, 'bob')).toBe(6)
  })

  it('triple collision: lex-smallest keeps, others move (one at a time)', () => {
    // alice < bob < charlie all at seat 0
    // alice keeps; bob and charlie both think they should move to max+1=1
    // → this is a known limitation (eventual consistency in 2 passes), but
    //   the function is deterministic: each caller computes the SAME answer
    //   for themselves on each render, so the next render will re-resolve.
    const players = [mkId('alice', 0), mkId('bob', 0), mkId('charlie', 0)]
    expect(resolveSeatCollision(players, 'alice')).toBeNull()
    expect(resolveSeatCollision(players, 'bob')).toBe(1)
    expect(resolveSeatCollision(players, 'charlie')).toBe(1)
    // After bob+charlie both move to seat 1, the SECOND pass resolves them:
    const after = [mkId('alice', 0), mkId('bob', 1), mkId('charlie', 1)]
    expect(resolveSeatCollision(after, 'bob')).toBeNull() // bob < charlie
    expect(resolveSeatCollision(after, 'charlie')).toBe(2)
  })

  it('idempotent: running on already-resolved state is a no-op', () => {
    const players = [mkId('alice', 0), mkId('bob', 1), mkId('carol', 2)]
    expect(resolveSeatCollision(players, 'alice')).toBeNull()
    expect(resolveSeatCollision(players, 'bob')).toBeNull()
    expect(resolveSeatCollision(players, 'carol')).toBeNull()
  })

  it('deterministic: every peer computes the same answer for a given player', () => {
    // Two callers (alice and bob) both ask "what should bob do?" — they
    // must agree on the answer.
    const players = [mkId('alice', 0), mkId('bob', 0)]
    const fromAlicePerspective = resolveSeatCollision(players, 'bob')
    const fromBobPerspective = resolveSeatCollision(players, 'bob')
    expect(fromAlicePerspective).toBe(fromBobPerspective)
  })
})
