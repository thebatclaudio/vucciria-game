import * as Y from 'yjs'
import type { GameMeta, Player } from '@/game/types'

/**
 * Shape of the shared Yjs document for a single game room.
 *
 * - `meta` (Y.Map<string, any>) — single-shot game metadata (status, host, turn, code, ...)
 * - `players` (Y.Map<peerId, Y.Map<string, any>>) — one nested map per player
 * - `deck` (Y.Array<string>) — current shuffled order of card ids
 * - `deckIndex` is stored inside `meta` to keep all mutable scalars in one map
 *
 * NOTE: We intentionally use Y.Maps with primitive fields rather than plain
 * JS objects so concurrent mutations from peers (e.g. host decrementing
 * lives at the same time someone else updates the turn) merge cleanly.
 */
export function createGameDoc(): Y.Doc {
  return new Y.Doc()
}

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap('meta')
}

export function getPlayers(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>('players')
}

export function getDeck(doc: Y.Doc): Y.Array<string> {
  return doc.getArray<string>('deck')
}

export function readMeta(doc: Y.Doc): Partial<GameMeta> {
  const m = getMeta(doc)
  const lastCardId = (m.get('lastCardId') as string | null) ?? null
  // Default `cardPhase` so docs created before the phase-machine landed
  // (rehydrated from IndexedDB) still produce a sensible UI: with no card
  // on the table we're awaiting a draw, otherwise the card already
  // resolved (best we can infer — those old docs had no in-flight choices).
  const cardPhase =
    (m.get('cardPhase') as GameMeta['cardPhase'] | undefined) ??
    (lastCardId ? 'resolved' : 'awaiting-draw')
  return {
    code: m.get('code') as string,
    name: m.get('name') as string,
    startingLives: m.get('startingLives') as number,
    location: (m.get('location') as string | null) ?? null,
    hostPeerId: m.get('hostPeerId') as string,
    status: (m.get('status') as GameMeta['status']) ?? 'lobby',
    turnSeat: (m.get('turnSeat') as number) ?? 0,
    createdAt: m.get('createdAt') as number,
    lastCardId,
    winnerPeerId: (m.get('winnerPeerId') as string | null) ?? null,
    cardPhase,
    pendingChosenIds:
      (m.get('pendingChosenIds') as string[] | undefined) ?? [],
    jollyHolderId: (m.get('jollyHolderId') as string | null) ?? null,
  }
}

export function readPlayers(doc: Y.Doc): Player[] {
  const out: Player[] = []
  getPlayers(doc).forEach((pm, peerId) => {
    out.push({
      peerId,
      nickname: pm.get('nickname') as string,
      emoji: pm.get('emoji') as string,
      lives: pm.get('lives') as number,
      seat: pm.get('seat') as number,
      joinedAt: pm.get('joinedAt') as number,
      trysteroPeerId: (pm.get('trysteroPeerId') as string | undefined) ?? null,
    })
  })
  return out
}

export function makePlayerMap(p: Player): Y.Map<unknown> {
  const m = new Y.Map<unknown>()
  m.set('nickname', p.nickname)
  m.set('emoji', p.emoji)
  m.set('lives', p.lives)
  m.set('seat', p.seat)
  m.set('joinedAt', p.joinedAt)
  if (p.trysteroPeerId) m.set('trysteroPeerId', p.trysteroPeerId)
  return m
}

/**
 * Find a player entry by its current Trystero (wire) peer id. Returns the
 * stable application playerId (the Y.Map key) so callers can `players.delete`
 * them or update their entry. Returns null if no matching player exists.
 */
export function findPlayerIdByTrysteroPeerId(
  doc: Y.Doc,
  trysteroPeerId: string,
): string | null {
  let found: string | null = null
  getPlayers(doc).forEach((pm, playerId) => {
    if ((pm.get('trysteroPeerId') as string | undefined) === trysteroPeerId) {
      found = playerId
    }
  })
  return found
}
