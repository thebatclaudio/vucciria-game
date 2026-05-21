import type * as Y from 'yjs'
import { getCard } from './cards'
import { getMeta, getPlayers, readPlayers } from '@/net/ydoc'
import { aliveNeighbors, alivePlayers } from './rules'
import type { CardEffect, Player } from './types'

/**
 * Pure resolver: given the current alive set + drawer + effect, return the
 * deterministic target list for an `auto` card. Order doesn't matter for
 * correctness (each target is mutated independently) but the list is
 * deduped so e.g. a 2-player `treAveMaria` doesn't hit the same neighbor
 * twice.
 *
 * Returns peerIds only; callers do the mutation.
 */
export function resolveAutoTargets(
  players: Player[],
  drawerId: string,
  effect: CardEffect,
): string[] {
  if (effect.resolution !== 'auto') return []
  const drawer = players.find((p) => p.peerId === drawerId)
  if (!drawer) return []

  switch (effect.autoTarget) {
    case 'self':
      return [drawer.peerId]
    case 'all':
      return alivePlayers(players).map((p) => p.peerId)
    case 'neighbors': {
      const { left, right } = aliveNeighbors(players, drawer.seat)
      const ids = new Set<string>([drawer.peerId])
      if (left) ids.add(left.peerId)
      if (right) ids.add(right.peerId)
      return [...ids]
    }
    default:
      return []
  }
}

/**
 * Apply a `delta` to one player's lives, honoring the Jolly token.
 *
 * Mutates the Y.Map directly. MUST be called inside a `doc.transact()`.
 *
 * Returns a short outcome tag for logging / UI feedback:
 *   - `'jolly-consumed'`: target held the Jolly; token cleared, lives untouched.
 *   - `'lives-changed'`: lives mutated.
 *   - `'no-op'`: delta was 0 or target missing.
 */
function applyDeltaToPlayer(
  doc: Y.Doc,
  targetId: string,
  delta: number,
): 'jolly-consumed' | 'lives-changed' | 'no-op' {
  if (delta === 0) return 'no-op'
  const playersMap = getPlayers(doc)
  const pm = playersMap.get(targetId)
  if (!pm) return 'no-op'

  // Jolly token absorbs the first incoming negative delta.
  if (delta < 0) {
    const meta = getMeta(doc)
    const holder = meta.get('jollyHolderId') as string | null | undefined
    if (holder && holder === targetId) {
      meta.set('jollyHolderId', null)
      return 'jolly-consumed'
    }
  }

  const cur = (pm.get('lives') as number) ?? 0
  pm.set('lives', Math.max(0, cur + delta))
  return 'lives-changed'
}

/**
 * Apply the drawn card's effect.
 *
 * Pure-ish: takes a Y.Doc and mutates it inside a single transaction so
 * the CRDT update is atomic from peers' perspective. Always sets
 * `meta.cardPhase = 'resolved'` at the end.
 *
 * `chosenIds` is required for non-auto resolutions:
 *   - drawer-choice: `[targetId]` (1 element).
 *   - host-choice with targetCount=1: `[targetId]` (1 element).
 *   - host-choice with targetCount='any': N elements (may be empty).
 *   - duel (host step): `[loserId]` (1 element, must be drawer or
 *     opponent — the caller is responsible for that constraint).
 *
 * For the duel's drawer step (drawer picks opponent), do NOT call this
 * function — instead just write `meta.pendingChosenIds = [opponentId]`
 * and `meta.cardPhase = 'awaiting-host-pick'`.
 *
 * `manual` cards (mossa) skip the effect entirely; the caller should
 * just set `cardPhase = 'resolved'` directly.
 */
export function applyCardEffect(
  doc: Y.Doc,
  cardId: string,
  drawerId: string,
  chosenIds: string[] = [],
): void {
  const card = getCard(cardId)
  const effect = card.effect
  const meta = getMeta(doc)

  doc.transact(() => {
    // Grant the Jolly token before applying any deltas, so the drawer
    // can immediately benefit from it if (hypothetically) the same card
    // also dealt them damage.
    if (effect.grantsJolly) {
      meta.set('jollyHolderId', drawerId)
    }

    // Build the list of targets that receive `effect.delta`.
    let targets: string[] = []
    if (effect.resolution === 'auto') {
      const players = readPlayers(doc)
      targets = resolveAutoTargets(players, drawerId, effect)
    } else if (
      effect.resolution === 'drawer-choice' ||
      effect.resolution === 'host-choice' ||
      effect.resolution === 'duel'
    ) {
      // Dedupe in case the same id arrived twice from a noisy UI.
      targets = [...new Set(chosenIds)]
    } else {
      // 'manual' — nothing to apply.
      targets = []
    }

    // For `auto` targets, the drawer is already included via the
    // resolver where appropriate, so we don't add them again via
    // `drawerDelta`. `drawerDelta` is meant for choice/duel cards that
    // want to also hit the drawer in addition to the chosen target(s).
    for (const id of targets) {
      applyDeltaToPlayer(doc, id, effect.delta)
    }

    if (
      effect.drawerDelta &&
      effect.drawerDelta !== 0 &&
      effect.resolution !== 'auto'
    ) {
      applyDeltaToPlayer(doc, drawerId, effect.drawerDelta)
    }

    // Clear duel scratch space on resolution.
    meta.set('pendingChosenIds', [])
    meta.set('cardPhase', 'resolved')
  })
}

/**
 * Compute which phase a freshly-drawn card should enter.
 *
 * `auto` and `manual` resolve immediately (the caller still invokes
 * `applyCardEffect` for `auto`; `manual` just sets phase to 'resolved').
 *
 * Choice/duel cards transition to a waiting-for-input phase.
 */
export function initialPhaseFor(cardId: string):
  | 'awaiting-drawer-pick'
  | 'awaiting-host-pick'
  | 'resolved' {
  const card = getCard(cardId)
  switch (card.effect.resolution) {
    case 'drawer-choice':
    case 'duel':
      return 'awaiting-drawer-pick'
    case 'host-choice':
      return 'awaiting-host-pick'
    case 'auto':
    case 'manual':
    default:
      return 'resolved'
  }
}
