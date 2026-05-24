import type { TFunction } from 'i18next'
import { getCard } from './cards'
import { resolveAutoTargets } from './effects'
import type { Player } from './types'

/**
 * Build a short, human-readable summary of what a card did, to render in
 * the `resolved` phase instead of the generic "Effect applied" banner.
 *
 * Inputs are all serializable so this function is fully pure / testable.
 *
 * Strategy: derive the affected target list per resolution type, then
 * format with i18n. Returns a translation-ready string.
 */
export function buildEffectSummary(args: {
  cardId: string
  drawerId: string | null
  players: Player[]
  chosenIds: string[] // for choice / duel / host cards: the resolved targets
  t: TFunction
}): string {
  const { cardId, drawerId, players, chosenIds, t } = args
  const card = getCard(cardId)
  const effect = card.effect
  const drawer = drawerId
    ? players.find((p) => p.peerId === drawerId) ?? null
    : null
  const nameOf = (id: string): string =>
    players.find((p) => p.peerId === id)?.nickname ?? '?'

  // Helpers
  const drinkOne = (name: string): string =>
    t('play.summary.drinkOne', { name })
  const drinkBoth = (a: string, b: string): string =>
    t('play.summary.drinkBoth', { a, b })
  const allDrink = (): string => t('play.summary.allDrink')
  const noOne = (): string => t('play.summary.noOne')

  switch (effect.resolution) {
    case 'auto': {
      if (effect.grantsJolly && drawer) {
        return t('play.summary.jollyGranted', { name: drawer.nickname })
      }
      if (effect.delta === 0) {
        // Free pass card (pipi).
        return drawer
          ? t('play.summary.freePass', { name: drawer.nickname })
          : t('play.summary.nothingHappened')
      }
      // Negative delta on the auto target set.
      const targetIds = drawer
        ? resolveAutoTargets(players, drawer.peerId, effect)
        : []
      if (targetIds.length === 0) return t('play.summary.nothingHappened')
      if (effect.autoTarget === 'all') return allDrink()
      if (targetIds.length === 1) return drinkOne(nameOf(targetIds[0]))
      // neighbors (drawer + up to 2)
      const names = targetIds.map(nameOf).join(', ')
      return t('play.summary.multipleDrink', { names })
    }

    case 'drawer-choice': {
      if (chosenIds.length === 0 || !drawer) {
        return t('play.summary.nothingHappened')
      }
      const targetId = chosenIds[0]
      const targetName = nameOf(targetId)
      if (effect.drawerDelta && effect.drawerDelta < 0) {
        // tuEcumpari: both drink (or, if drawer picked self, just drawer twice).
        if (targetId === drawer.peerId) {
          return t('play.summary.selfDoubleDrink', { name: drawer.nickname })
        }
        return drinkBoth(drawer.nickname, targetName)
      }
      // beviOoffri: only target drinks
      return drinkOne(targetName)
    }

    case 'host-choice': {
      if (chosenIds.length === 0) return noOne()
      if (chosenIds.length === 1) return drinkOne(nameOf(chosenIds[0]))
      const names = chosenIds.map(nameOf).join(', ')
      return t('play.summary.multipleDrink', { names })
    }

    case 'duel': {
      if (chosenIds.length === 0) return t('play.summary.nothingHappened')
      return drinkOne(nameOf(chosenIds[0]))
    }

    case 'manual': {
      // mossa — table polices itself.
      return t('play.summary.manualMove')
    }

    default:
      return t('play.summary.nothingHappened')
  }
}

/**
 * Convenience: derive the resolved-target ids for a `resolved`-phase card
 * by reading the Yjs meta scratch space + the card spec. Used by the UI
 * so it can call `buildEffectSummary` without re-implementing the logic.
 *
 * For auto cards, the targets are computed from the player list + drawer.
 * For choice/duel/host cards, they are stored in `pendingChosenIds` only
 * during the in-flight steps; once `applyCardEffect` resolves them it
 * clears that field. So callers must keep a local cache of the chosen
 * ids at the moment of resolution. The simplest path used in Play.tsx is
 * to read `pendingChosenIds` from a previous phase if non-empty, or fall
 * back to deriving from drawer/auto-target.
 *
 * If you have an authoritative list of chosen ids, prefer passing it
 * directly to `buildEffectSummary`.
 */
export function deriveAutoSummaryTargets(
  cardId: string,
  drawerId: string | null,
  players: Player[],
): string[] {
  if (!drawerId) return []
  const card = getCard(cardId)
  if (card.effect.resolution !== 'auto') return []
  return resolveAutoTargets(players, drawerId, card.effect)
}
