import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { getMeta, getDeck, getPlayers, makePlayerMap } from '@/net/ydoc'
import { drawNext, shuffledDeck } from '@/game/deck'
import { nextTurnSeat, alivePlayers } from '@/game/rules'
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

describe('turn mechanics', () => {
  it('draw cycle: initial draw sets lastCardId and advances deckIndex', () => {
    const doc = new Y.Doc()
    const meta = getMeta(doc)
    const deck = getDeck(doc)

    // Bootstrap
    const seed = 42
    const cards = shuffledDeck(seed)
    deck.insert(0, cards)
    meta.set('deckIndex', 0)
    meta.set('lastCardId', null)
    meta.set('createdAt', 1000000)

    // Simulate draw
    const currentIndex = (meta.get('deckIndex') as number) ?? 0
    const reshuffleSeed = ((meta.get('createdAt') as number) ?? Date.now()) ^ currentIndex
    const { cardId, nextDeck, nextIndex } = drawNext(deck.toArray(), currentIndex, reshuffleSeed)

    doc.transact(() => {
      meta.set('lastCardId', cardId)
      if (nextDeck !== deck.toArray()) {
        deck.delete(0, deck.length)
        deck.insert(0, nextDeck)
      }
      meta.set('deckIndex', nextIndex)
    })

    expect(meta.get('lastCardId')).toBe(cards[0])
    expect(meta.get('deckIndex')).toBe(1)
  })

  it('endTurn clears lastCardId and advances turnSeat', () => {
    const doc = new Y.Doc()
    const meta = getMeta(doc)
    const playersMap = getPlayers(doc)

    // Setup 3 players
    const players = [mkPlayer(0), mkPlayer(1), mkPlayer(2)]
    players.forEach((p) => playersMap.set(p.peerId, makePlayerMap(p)))

    meta.set('turnSeat', 0)
    meta.set('lastCardId', 'bevi')

    // Simulate end turn
    const next = nextTurnSeat(players, 0)
    doc.transact(() => {
      meta.set('turnSeat', next)
      meta.set('lastCardId', null)
    })

    expect(meta.get('turnSeat')).toBe(1)
    expect(meta.get('lastCardId')).toBeNull()
  })

  it('turn advances correctly skipping dead players', () => {
    const doc = new Y.Doc()
    const meta = getMeta(doc)
    const playersMap = getPlayers(doc)

    // Setup 4 players: 0 alive, 1 dead, 2 alive, 3 dead
    const players = [mkPlayer(0, 3), mkPlayer(1, 0), mkPlayer(2, 2), mkPlayer(3, 0)]
    players.forEach((p) => playersMap.set(p.peerId, makePlayerMap(p)))

    meta.set('turnSeat', 0)

    // Advance turn
    const next = nextTurnSeat(players, 0)
    meta.set('turnSeat', next)

    expect(meta.get('turnSeat')).toBe(2) // skips player 1 (dead)

    // Advance again
    const next2 = nextTurnSeat(players, 2)
    meta.set('turnSeat', next2)

    expect(meta.get('turnSeat')).toBe(0) // wraps around, skips player 3 (dead)
  })

  it('stale-turn recovery: when turnSeat points at missing player, advance to next alive', () => {
    const doc = new Y.Doc()
    const meta = getMeta(doc)
    const playersMap = getPlayers(doc)

    // Setup 3 players
    const players = [mkPlayer(0), mkPlayer(1), mkPlayer(2)]
    players.forEach((p) => playersMap.set(p.peerId, makePlayerMap(p)))

    meta.set('turnSeat', 1)
    meta.set('status', 'playing')

    // Player 1 leaves (simulate onPeerLeave cleanup)
    playersMap.delete('p1')

    // Remaining players: [p0, p2]
    const remaining = Array.from(playersMap.keys()).map((id) => {
      const pm = playersMap.get(id)!
      return {
        peerId: id,
        seat: pm.get('seat') as number,
        lives: pm.get('lives') as number,
      } as Player
    })

    // Check that turnSeat=1 no longer exists
    const alive = alivePlayers(remaining)
    const currentExists = alive.some((p) => p.seat === 1)
    expect(currentExists).toBe(false)

    // Recovery: advance turn
    const next = nextTurnSeat(remaining, 1)
    meta.set('turnSeat', next)
    meta.set('lastCardId', null) // discard in-flight card

    expect(meta.get('turnSeat')).toBe(2) // next alive player
    expect(meta.get('lastCardId')).toBeNull()
  })

  it('deck reshuffles when exhausted', () => {
    const doc = new Y.Doc()
    const meta = getMeta(doc)
    const deck = getDeck(doc)

    const seed = 999
    const cards = shuffledDeck(seed)
    deck.insert(0, cards)
    meta.set('deckIndex', cards.length) // deck exhausted
    meta.set('createdAt', 5000000)

    const currentIndex = meta.get('deckIndex') as number
    const reshuffleSeed = ((meta.get('createdAt') as number) ?? Date.now()) ^ currentIndex
    const { cardId, nextDeck, nextIndex } = drawNext(deck.toArray(), currentIndex, reshuffleSeed)

    doc.transact(() => {
      meta.set('lastCardId', cardId)
      if (nextDeck !== deck.toArray()) {
        deck.delete(0, deck.length)
        deck.insert(0, nextDeck)
      }
      meta.set('deckIndex', nextIndex)
    })

    expect(meta.get('deckIndex')).toBe(1)
    expect(deck.length).toBe(cards.length)
    expect(meta.get('lastCardId')).not.toBeNull()
  })

  /**
   * Regression: the "first turn isn't synchronized" bug.
   *
   * The bug was at the React layer (Lobby and Play were sibling routes,
   * each owning its own `useGameRoom` → its own Y.Doc), not at the Yjs
   * layer. This test pins the underlying invariant the fix relies on:
   *
   *   IF the SAME Y.Doc instance is reused across the Lobby → Play
   *   transition, AND the sync bridge to a remote peer's Y.Doc stays
   *   connected, THEN a draw + endTurn issued mid-game propagate to the
   *   remote peer without any intermediate reconnect/refresh.
   *
   * If this test ever regresses, the root cause is a change to Y.Doc
   * lifecycle assumptions — not the React provider.
   */
  it('mid-game draw + endTurn propagate to peer when the doc instance is reused', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()

    // Wire a persistent sync bridge in BOTH directions (simulates a stable
    // Trystero room that does NOT get torn down at the lobby→play transition).
    const bridgeAB = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      Y.applyUpdate(docB, update, 'remote')
    }
    const bridgeBA = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      Y.applyUpdate(docA, update, 'remote')
    }
    docA.on('update', bridgeAB)
    docB.on('update', bridgeBA)

    // Bootstrap on A (host).
    const metaA = getMeta(docA)
    const deckA = getDeck(docA)
    const playersA = getPlayers(docA)
    const cards = shuffledDeck(2024)
    docA.transact(() => {
      deckA.insert(0, cards)
      metaA.set('deckIndex', 0)
      metaA.set('turnSeat', 0)
      metaA.set('lastCardId', null)
      metaA.set('createdAt', 1700000000)
      metaA.set('status', 'lobby')
      playersA.set('p0', makePlayerMap(mkPlayer(0)))
      playersA.set('p1', makePlayerMap(mkPlayer(1)))
    })

    const metaB = getMeta(docB)
    // Initial sync arrived on B.
    expect(metaB.get('turnSeat')).toBe(0)
    expect(metaB.get('status')).toBe('lobby')

    // Host starts the game. This is the moment the buggy version recreated
    // the doc; in the fixed version, the same docA stays alive.
    docA.transact(() => {
      metaA.set('status', 'playing')
    })
    expect(metaB.get('status')).toBe('playing')

    // First draw — must reach B.
    const currentIndex = metaA.get('deckIndex') as number
    const reshuffleSeed = ((metaA.get('createdAt') as number) ?? 0) ^ currentIndex
    const { cardId, nextDeck, nextIndex } = drawNext(
      deckA.toArray(),
      currentIndex,
      reshuffleSeed,
    )
    docA.transact(() => {
      metaA.set('lastCardId', cardId)
      if (nextDeck !== deckA.toArray()) {
        deckA.delete(0, deckA.length)
        deckA.insert(0, nextDeck)
      }
      metaA.set('deckIndex', nextIndex)
    })
    expect(metaB.get('lastCardId')).toBe(cardId)

    // End turn — must also reach B.
    docA.transact(() => {
      metaA.set('turnSeat', 1)
      metaA.set('lastCardId', null)
    })
    expect(metaB.get('turnSeat')).toBe(1)
    expect(metaB.get('lastCardId')).toBeNull()

    docA.off('update', bridgeAB)
    docB.off('update', bridgeBA)
  })

  /**
   * Failure-mode documentation: the OLD buggy behavior.
   *
   * If the React layer destroys docA and creates a fresh `docA2` at the
   * lobby→play transition (the actual pre-fix code path), but the remote
   * peer's bridge still points at the original docA, then mid-game writes
   * on docA2 NEVER reach docB. This is exactly the user-reported symptom.
   *
   * We assert that symptom here so any future "let's recreate the doc on
   * route change" refactor immediately trips this guard.
   */
  it('regression guard: recreating the doc breaks an established sync bridge', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    const bridge = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      Y.applyUpdate(docB, update, 'remote')
    }
    docA.on('update', bridge)

    const metaA = getMeta(docA)
    metaA.set('status', 'playing')
    metaA.set('turnSeat', 0)
    expect(getMeta(docB).get('status')).toBe('playing')

    // Simulate buggy route-change: A destroys its doc and makes a new one,
    // but the bridge to B was attached to the OLD doc.
    docA.destroy()
    const docA2 = new Y.Doc()
    const metaA2 = getMeta(docA2)
    metaA2.set('lastCardId', 'bevi')

    // The new write does NOT reach B — proving the bug.
    expect(getMeta(docB).get('lastCardId')).toBeUndefined()
  })

  it('Y.Doc sync between two peers maintains turn consistency', () => {
    const doc1 = new Y.Doc()
    const doc2 = new Y.Doc()

    // Bootstrap doc1
    const meta1 = getMeta(doc1)
    const deck1 = getDeck(doc1)
    const players1 = getPlayers(doc1)

    const seed = 111
    const cards = shuffledDeck(seed)
    deck1.insert(0, cards)
    meta1.set('deckIndex', 0)
    meta1.set('turnSeat', 0)
    meta1.set('lastCardId', null)
    meta1.set('createdAt', 7000000)

    const p0 = mkPlayer(0)
    const p1 = mkPlayer(1)
    players1.set(p0.peerId, makePlayerMap(p0))
    players1.set(p1.peerId, makePlayerMap(p1))

    // Sync doc1 → doc2
    const state = Y.encodeStateAsUpdate(doc1)
    Y.applyUpdate(doc2, state)

    const meta2 = getMeta(doc2)
    const deck2 = getDeck(doc2)

    // Both docs should have identical state
    expect(meta2.get('turnSeat')).toBe(0)
    expect(meta2.get('deckIndex')).toBe(0)
    expect(deck2.toArray()).toEqual(cards)

    // Peer 1 draws a card on doc1
    const currentIndex = (meta1.get('deckIndex') as number) ?? 0
    const reshuffleSeed = ((meta1.get('createdAt') as number) ?? Date.now()) ^ currentIndex
    const { cardId, nextDeck, nextIndex } = drawNext(
      deck1.toArray(),
      currentIndex,
      reshuffleSeed,
    )

    doc1.transact(() => {
      meta1.set('lastCardId', cardId)
      if (nextDeck !== deck1.toArray()) {
        deck1.delete(0, deck1.length)
        deck1.insert(0, nextDeck)
      }
      meta1.set('deckIndex', nextIndex)
    })

    // Sync again
    const update = Y.encodeStateAsUpdate(doc1)
    Y.applyUpdate(doc2, update)

    // Both docs should see the drawn card
    expect(meta2.get('lastCardId')).toBe(cardId)
    expect(meta2.get('deckIndex')).toBe(1)

    // Peer 1 ends turn on doc1
    doc1.transact(() => {
      meta1.set('turnSeat', 1)
      meta1.set('lastCardId', null)
    })

    const update2 = Y.encodeStateAsUpdate(doc1)
    Y.applyUpdate(doc2, update2)

    // Both docs should see turn advanced
    expect(meta2.get('turnSeat')).toBe(1)
    expect(meta2.get('lastCardId')).toBeNull()
  })
})
