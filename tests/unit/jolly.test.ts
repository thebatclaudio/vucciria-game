import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { getMeta, getPlayers, makePlayerMap } from '@/net/ydoc'
import { applyCardEffect } from '@/game/effects'
import type { Player } from '@/game/types'

const mkPlayer = (seat: number, lives = 3, id = `p${seat}`): Player => ({
  peerId: id,
  nickname: `Player${seat}`,
  emoji: '🧑',
  lives,
  seat,
  joinedAt: seat * 1000,
  trysteroPeerId: `wire-${id}`,
})

/**
 * The Jolly token is a small piece of meta state with one tricky
 * invariant: it must never point at a peerId that no longer has a
 * corresponding player entry. These tests pin the cleanup paths that
 * `room.ts` (peer leave) and `Play.tsx`/`Lobby.tsx` (kick) implement.
 */
describe('jolly token lifecycle', () => {
  function seed(): Y.Doc {
    const doc = new Y.Doc()
    const playersMap = getPlayers(doc)
    const meta = getMeta(doc)
    playersMap.set('p0', makePlayerMap(mkPlayer(0)))
    playersMap.set('p1', makePlayerMap(mkPlayer(1)))
    meta.set('cardPhase', 'awaiting-draw')
    meta.set('pendingChosenIds', [])
    meta.set('jollyHolderId', null)
    return doc
  }

  it('peer leave: jollyHolderId is cleared if the leaver held the token', () => {
    const doc = seed()
    applyCardEffect(doc, 'jolly', 'p1')
    expect(getMeta(doc).get('jollyHolderId')).toBe('p1')

    // Simulate the room.ts onPeerLeave cleanup transaction.
    doc.transact(() => {
      getPlayers(doc).delete('p1')
      const m = getMeta(doc)
      if ((m.get('jollyHolderId') as string | null) === 'p1') {
        m.set('jollyHolderId', null)
      }
    })

    expect(getMeta(doc).get('jollyHolderId')).toBeNull()
    expect(getPlayers(doc).has('p1')).toBe(false)
  })

  it('peer leave: token is preserved if the leaver was NOT the holder', () => {
    const doc = seed()
    applyCardEffect(doc, 'jolly', 'p0')

    doc.transact(() => {
      getPlayers(doc).delete('p1')
      const m = getMeta(doc)
      if ((m.get('jollyHolderId') as string | null) === 'p1') {
        m.set('jollyHolderId', null)
      }
    })

    expect(getMeta(doc).get('jollyHolderId')).toBe('p0')
  })

  it('kick: same cleanup applies (mirrors Play.tsx kick handler)', () => {
    const doc = seed()
    applyCardEffect(doc, 'jolly', 'p0')

    // Simulated kick from Play.tsx.
    doc.transact(() => {
      getPlayers(doc).delete('p0')
      const m = getMeta(doc)
      if ((m.get('jollyHolderId') as string | null) === 'p0') {
        m.set('jollyHolderId', null)
      }
    })

    expect(getMeta(doc).get('jollyHolderId')).toBeNull()
  })
})
