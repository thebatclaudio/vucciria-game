import type * as Y from 'yjs'
import { getMeta, getPlayers, getDeck, readMeta } from '@/net/ydoc'
import { shuffledDeck } from './deck'
import { orderedPlayers } from './rules'

/**
 * Reset the shared Yjs document so the same room can play another match.
 *
 * Behaviour:
 *   - All surviving players keep their seats, nicknames, and emojis.
 *   - Eliminated players (lives === 0 at game-over) are also retained —
 *     the game-over screen is the natural moment to give them a fresh
 *     life count if the table wants a rematch; kicking them out instead
 *     would force a fresh code + re-share.
 *   - Each player's `lives` is reset to `meta.startingLives`.
 *   - The deck is reshuffled with a new seed derived from `Date.now()`
 *     XOR'd with the game code so peers all agree on the new order.
 *   - `meta.status` → `'playing'`, `winnerPeerId` cleared,
 *     `cardPhase` → `'awaiting-draw'`, `lastCardId` cleared,
 *     `pendingChosenIds` reset, `jollyHolderId` cleared,
 *     `turnSeat` set to seat 0 (the same lowest-seat player who started
 *     last time leads off again).
 *   - `startingPlayerCount` snapshot is refreshed against the current
 *     roster so the winner-check still works after later leaves/kicks.
 *
 * Invariant: this is the *only* writer that flips status from `over`
 * back to `playing`. Survivors watching `/over/:code` observe the flip
 * via `useGameMeta` and navigate to `/play/:code` on their own.
 *
 * Idempotent: safe to call once per "Rematch" click. The transaction is
 * atomic so partial state never leaks to peers.
 */
export function restartGame(doc: Y.Doc): void {
  const m = getMeta(doc)
  const meta = readMeta(doc)
  if (meta.status !== 'over') return
  const playersMap = getPlayers(doc)
  const startingLives = meta.startingLives ?? 3
  const code = meta.code ?? ''
  const reshuffleSeed = Date.now() ^
    [...code].reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7)
  const fresh = shuffledDeck(reshuffleSeed)

  doc.transact(() => {
    // Reset every player's lives (also resurrects anyone at 0).
    playersMap.forEach((pm) => {
      pm.set('lives', startingLives)
    })
    // Refresh deck with the new seed.
    const deck = getDeck(doc)
    deck.delete(0, deck.length)
    deck.insert(0, fresh)
    // Reset the meta scalars.
    const playersArr = orderedPlayers(
      [...playersMap.entries()].map(([peerId, pm]) => ({
        peerId,
        nickname: pm.get('nickname') as string,
        emoji: pm.get('emoji') as string,
        lives: pm.get('lives') as number,
        seat: pm.get('seat') as number,
        joinedAt: pm.get('joinedAt') as number,
      })),
    )
    m.set('status', 'playing')
    m.set('winnerPeerId', null)
    m.set('lastCardId', null)
    m.set('cardPhase', 'awaiting-draw')
    m.set('pendingChosenIds', [])
    m.set('jollyHolderId', null)
    m.set('deckIndex', 0)
    m.set('turnSeat', playersArr[0]?.seat ?? 0)
    m.set('startingPlayerCount', playersArr.length)
  })
}
