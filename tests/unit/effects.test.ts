import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import {
  getDeck,
  getMeta,
  getPlayers,
  makePlayerMap,
  readPlayers,
} from '@/net/ydoc'
import { applyCardEffect, initialPhaseFor, resolveAutoTargets } from '@/game/effects'
import { getCard } from '@/game/cards'
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

/** Seed a doc with N players at seats 0..N-1, all alive with `lives`. */
function seedDoc(playerCount: number, lives = 3): Y.Doc {
  const doc = new Y.Doc()
  const playersMap = getPlayers(doc)
  const meta = getMeta(doc)
  for (let i = 0; i < playerCount; i++) {
    playersMap.set(`p${i}`, makePlayerMap(mkPlayer(i, lives)))
  }
  meta.set('cardPhase', 'awaiting-draw')
  meta.set('pendingChosenIds', [])
  meta.set('jollyHolderId', null)
  return doc
}

function livesOf(doc: Y.Doc, peerId: string): number {
  const pm = getPlayers(doc).get(peerId)
  return (pm?.get('lives') as number) ?? -1
}

describe('resolveAutoTargets', () => {
  it('self target returns just the drawer', () => {
    const players = [mkPlayer(0), mkPlayer(1), mkPlayer(2)]
    const targets = resolveAutoTargets(players, 'p1', getCard('bevi').effect)
    expect(targets).toEqual(['p1'])
  })

  it('all target returns every alive player', () => {
    const players = [mkPlayer(0, 3), mkPlayer(1, 0), mkPlayer(2, 2)]
    const targets = resolveAutoTargets(
      players,
      'p0',
      getCard('bevonoTutti').effect,
    )
    expect(targets.sort()).toEqual(['p0', 'p2'])
  })

  it('neighbors target returns drawer + left + right', () => {
    const players = [mkPlayer(0), mkPlayer(1), mkPlayer(2), mkPlayer(3)]
    const targets = resolveAutoTargets(
      players,
      'p1',
      getCard('treAveMaria').effect,
    )
    // p0 (left), p1 (drawer), p2 (right)
    expect(new Set(targets)).toEqual(new Set(['p0', 'p1', 'p2']))
  })

  it('neighbors with only 2 alive dedupes the same neighbor on both sides', () => {
    const players = [mkPlayer(0), mkPlayer(1)]
    const targets = resolveAutoTargets(
      players,
      'p0',
      getCard('treAveMaria').effect,
    )
    // p0 drawer, p1 is both left and right — must appear only once.
    expect(targets.length).toBe(2)
    expect(new Set(targets)).toEqual(new Set(['p0', 'p1']))
  })

  it('drawer missing → empty target list', () => {
    const players = [mkPlayer(0), mkPlayer(1)]
    const targets = resolveAutoTargets(players, 'ghost', getCard('bevi').effect)
    expect(targets).toEqual([])
  })

  it('non-auto card returns empty list', () => {
    const players = [mkPlayer(0), mkPlayer(1)]
    const targets = resolveAutoTargets(
      players,
      'p0',
      getCard('beviOoffri').effect,
    )
    expect(targets).toEqual([])
  })
})

describe('initialPhaseFor', () => {
  it('auto cards land in resolved (effect applied right away)', () => {
    expect(initialPhaseFor('bevi')).toBe('resolved')
    expect(initialPhaseFor('treAveMaria')).toBe('resolved')
    expect(initialPhaseFor('bevonoTutti')).toBe('resolved')
    expect(initialPhaseFor('pipi')).toBe('resolved')
    expect(initialPhaseFor('jolly')).toBe('resolved')
  })

  it('manual cards land in resolved', () => {
    expect(initialPhaseFor('mossa')).toBe('resolved')
  })

  it('drawer-choice and duel land in awaiting-drawer-pick', () => {
    expect(initialPhaseFor('beviOoffri')).toBe('awaiting-drawer-pick')
    expect(initialPhaseFor('tuEcumpari')).toBe('awaiting-drawer-pick')
    expect(initialPhaseFor('sfida')).toBe('awaiting-drawer-pick')
  })

  it('host-choice cards land in awaiting-host-pick', () => {
    expect(initialPhaseFor('setteBum')).toBe('awaiting-host-pick')
    expect(initialPhaseFor('ventuno')).toBe('awaiting-host-pick')
    expect(initialPhaseFor('storia')).toBe('awaiting-host-pick')
    expect(initialPhaseFor('zingBoing')).toBe('awaiting-host-pick')
  })
})

describe('applyCardEffect — auto cards', () => {
  it('bevi: drawer loses one life', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'bevi', 'p1')
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p1')).toBe(2)
    expect(livesOf(doc, 'p2')).toBe(3)
    expect(getMeta(doc).get('cardPhase')).toBe('resolved')
  })

  it('bevi at 1 life drops to 0 (clamped, not negative)', () => {
    const doc = seedDoc(2, 1)
    applyCardEffect(doc, 'bevi', 'p0')
    expect(livesOf(doc, 'p0')).toBe(0)
  })

  it('treAveMaria with 4 players: drawer + L + R all -1', () => {
    const doc = seedDoc(4)
    applyCardEffect(doc, 'treAveMaria', 'p1')
    expect(livesOf(doc, 'p0')).toBe(2) // left
    expect(livesOf(doc, 'p1')).toBe(2) // drawer
    expect(livesOf(doc, 'p2')).toBe(2) // right
    expect(livesOf(doc, 'p3')).toBe(3) // untouched
  })

  it('treAveMaria with 2 players: drawer + only-other-player, each -1 once', () => {
    const doc = seedDoc(2)
    applyCardEffect(doc, 'treAveMaria', 'p0')
    expect(livesOf(doc, 'p0')).toBe(2)
    expect(livesOf(doc, 'p1')).toBe(2) // NOT 1 (dedupe in resolveAutoTargets)
  })

  it('bevonoTutti: every alive player -1; dead are skipped', () => {
    const doc = seedDoc(3)
    getPlayers(doc).get('p1')!.set('lives', 0)
    applyCardEffect(doc, 'bevonoTutti', 'p0')
    expect(livesOf(doc, 'p0')).toBe(2)
    expect(livesOf(doc, 'p1')).toBe(0)
    expect(livesOf(doc, 'p2')).toBe(2)
  })

  it('pipi: no life change', () => {
    const doc = seedDoc(2)
    applyCardEffect(doc, 'pipi', 'p0')
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p1')).toBe(3)
    expect(getMeta(doc).get('cardPhase')).toBe('resolved')
  })

  it('jolly: sets jollyHolderId to drawer, no life change', () => {
    const doc = seedDoc(2)
    applyCardEffect(doc, 'jolly', 'p1')
    expect(getMeta(doc).get('jollyHolderId')).toBe('p1')
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p1')).toBe(3)
  })

  it('jolly transfers between players', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'jolly', 'p0')
    expect(getMeta(doc).get('jollyHolderId')).toBe('p0')
    applyCardEffect(doc, 'jolly', 'p2')
    expect(getMeta(doc).get('jollyHolderId')).toBe('p2')
    // Previous holder loses nothing beyond the token.
    expect(livesOf(doc, 'p0')).toBe(3)
  })
})

describe('applyCardEffect — jolly token interactions', () => {
  it('holder taking damage consumes the token instead of life', () => {
    const doc = seedDoc(2)
    applyCardEffect(doc, 'jolly', 'p0')
    expect(getMeta(doc).get('jollyHolderId')).toBe('p0')
    // Drawer is the holder, draws bevi → would normally -1.
    applyCardEffect(doc, 'bevi', 'p0')
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(getMeta(doc).get('jollyHolderId')).toBeNull()
  })

  it('holder hit by treAveMaria: token absorbs that hit, neighbors unaffected', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'jolly', 'p1')
    applyCardEffect(doc, 'treAveMaria', 'p1')
    // p1 had the token → token consumed, no life loss.
    expect(livesOf(doc, 'p1')).toBe(3)
    expect(getMeta(doc).get('jollyHolderId')).toBeNull()
    // Neighbors still lose normally.
    expect(livesOf(doc, 'p0')).toBe(2)
    expect(livesOf(doc, 'p2')).toBe(2)
  })

  it('non-holder hit while token is held: token is preserved', () => {
    const doc = seedDoc(2)
    applyCardEffect(doc, 'jolly', 'p1')
    applyCardEffect(doc, 'bevi', 'p0')
    expect(livesOf(doc, 'p0')).toBe(2)
    expect(getMeta(doc).get('jollyHolderId')).toBe('p1')
  })

  it('token only absorbs one hit, not subsequent ones', () => {
    const doc = seedDoc(2)
    applyCardEffect(doc, 'jolly', 'p0')
    applyCardEffect(doc, 'bevi', 'p0') // absorbed
    applyCardEffect(doc, 'bevi', 'p0') // hits for real
    expect(livesOf(doc, 'p0')).toBe(2)
    expect(getMeta(doc).get('jollyHolderId')).toBeNull()
  })
})

describe('applyCardEffect — drawer-choice cards', () => {
  it('beviOoffri pointing at someone else: only target -1', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'beviOoffri', 'p0', ['p2'])
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p1')).toBe(3)
    expect(livesOf(doc, 'p2')).toBe(2)
  })

  it('beviOoffri pointing at self: drawer -1', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'beviOoffri', 'p0', ['p0'])
    expect(livesOf(doc, 'p0')).toBe(2)
    expect(livesOf(doc, 'p1')).toBe(3)
    expect(livesOf(doc, 'p2')).toBe(3)
  })

  it('tuEcumpari: drawer AND chosen partner both -1', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'tuEcumpari', 'p0', ['p2'])
    expect(livesOf(doc, 'p0')).toBe(2) // via drawerDelta
    expect(livesOf(doc, 'p2')).toBe(2) // via delta
    expect(livesOf(doc, 'p1')).toBe(3)
  })

  it('tuEcumpari pointing at self: drawer -2? No — chosen and drawer are same id; dedupe means delta applies once, drawerDelta applies once', () => {
    // The choice flow would normally prevent this, but if it happens the
    // current implementation applies delta once (target) + drawerDelta once.
    const doc = seedDoc(2)
    applyCardEffect(doc, 'tuEcumpari', 'p0', ['p0'])
    // delta -1 to chosen p0, then drawerDelta -1 to p0. Net -2.
    expect(livesOf(doc, 'p0')).toBe(1)
  })
})

describe('applyCardEffect — host-choice cards', () => {
  it('host-choice single (ventuno): one target -1', () => {
    const doc = seedDoc(4)
    // Drawer = p0, host declared p2 lost.
    applyCardEffect(doc, 'ventuno', 'p0', ['p2'])
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p2')).toBe(2)
  })

  it('host-choice multi (storia) with multiple losers', () => {
    const doc = seedDoc(4)
    applyCardEffect(doc, 'storia', 'p0', ['p1', 'p3'])
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p1')).toBe(2)
    expect(livesOf(doc, 'p2')).toBe(3)
    expect(livesOf(doc, 'p3')).toBe(2)
  })

  it('host-choice multi with empty list (no one lost): no state change', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'setteBum', 'p0', [])
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p1')).toBe(3)
    expect(livesOf(doc, 'p2')).toBe(3)
    expect(getMeta(doc).get('cardPhase')).toBe('resolved')
  })

  it('duplicate ids in chosenIds are deduped (defense against UI flutter)', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'storia', 'p0', ['p1', 'p1', 'p1'])
    expect(livesOf(doc, 'p1')).toBe(2) // only -1, not -3
  })
})

describe('applyCardEffect — duel (sfida)', () => {
  it('host picks drawer as loser: drawer -1', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'sfida', 'p0', ['p0'])
    expect(livesOf(doc, 'p0')).toBe(2)
    expect(livesOf(doc, 'p2')).toBe(3)
  })

  it('host picks opponent as loser: opponent -1', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'sfida', 'p0', ['p2'])
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p2')).toBe(2)
  })

  it('pendingChosenIds is cleared after host resolves the duel', () => {
    const doc = seedDoc(3)
    const meta = getMeta(doc)
    meta.set('pendingChosenIds', ['p2'])
    applyCardEffect(doc, 'sfida', 'p0', ['p2'])
    expect(meta.get('pendingChosenIds')).toEqual([])
  })
})

describe('applyCardEffect — manual (mossa)', () => {
  it('does not mutate lives, just resolves the phase', () => {
    const doc = seedDoc(3)
    applyCardEffect(doc, 'mossa', 'p1')
    expect(livesOf(doc, 'p0')).toBe(3)
    expect(livesOf(doc, 'p1')).toBe(3)
    expect(livesOf(doc, 'p2')).toBe(3)
    expect(getMeta(doc).get('cardPhase')).toBe('resolved')
  })
})

describe('applyCardEffect — transaction atomicity', () => {
  it('all mutations land as a single Y update', () => {
    const doc = seedDoc(3)
    let updateCount = 0
    const handler = (_u: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      updateCount++
    }
    doc.on('update', handler)
    applyCardEffect(doc, 'treAveMaria', 'p1')
    doc.off('update', handler)
    // The whole effect (3 life updates + 2 meta updates) must fire one
    // transaction → one update event.
    expect(updateCount).toBe(1)
  })
})

describe('Player list integrity', () => {
  it('readPlayers reflects post-effect state', () => {
    const doc = seedDoc(2)
    // Sanity: deck/players don't get confused by an effect.
    getDeck(doc).insert(0, ['bevi'])
    applyCardEffect(doc, 'bevi', 'p0')
    const players = readPlayers(doc)
    const me = players.find((p) => p.peerId === 'p0')
    expect(me?.lives).toBe(2)
  })
})
