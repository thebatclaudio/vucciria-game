import type { CardDef } from './types'

/**
 * The 13 cards of VucciriaGame.
 *
 * Each card's user-facing title and description live in `src/i18n/{en,it}.json`
 * under `cards.<id>.title` and `cards.<id>.desc`.
 *
 * The `effect` field is the resolution spec consumed by
 * `src/game/effects.ts#applyCardEffect`. See `src/game/types.ts` for the
 * full schema and `tests/unit/effects.test.ts` for the per-card semantics.
 */
export const CARDS: CardDef[] = [
  // Manual — social rule the table polices itself; the host can use the
  // override panel if someone forgets the move.
  {
    id: 'mossa',
    icon: '🕺',
    effect: { resolution: 'manual', delta: 0 },
  },

  // Auto — drawer loses one shot.
  {
    id: 'bevi',
    icon: '🍺',
    effect: { resolution: 'auto', delta: -1, autoTarget: 'self' },
  },

  // Auto — drawer + both alive neighbors each lose one shot.
  {
    id: 'treAveMaria',
    icon: '👥',
    effect: { resolution: 'auto', delta: -1, autoTarget: 'neighbors' },
  },

  // Auto — every alive player (incl. drawer) loses one shot.
  {
    id: 'bevonoTutti',
    icon: '🍻',
    effect: { resolution: 'auto', delta: -1, autoTarget: 'all' },
  },

  // Auto — free pass. No state change beyond resolving the card.
  {
    id: 'pipi',
    icon: '🚽',
    effect: { resolution: 'auto', delta: 0, autoTarget: 'self' },
  },

  // Auto — drawer becomes the Jolly token holder (transferable spare life).
  // No `delta` is applied; the token itself is the reward.
  {
    id: 'jolly',
    icon: '🃏',
    effect: {
      resolution: 'auto',
      delta: 0,
      autoTarget: 'self',
      grantsJolly: true,
    },
  },

  // Drawer-choice — drawer picks one player (self allowed) who loses a shot.
  {
    id: 'beviOoffri',
    icon: '🎁',
    effect: { resolution: 'drawer-choice', delta: -1, targetCount: 1 },
  },

  // Drawer-choice — drawer picks a partner; both drawer and partner -1.
  {
    id: 'tuEcumpari',
    icon: '🤝',
    effect: {
      resolution: 'drawer-choice',
      delta: -1,
      drawerDelta: -1,
      targetCount: 1,
    },
  },

  // Duel — drawer picks the opponent, then the host declares the loser.
  {
    id: 'sfida',
    icon: '⚔️',
    effect: { resolution: 'duel', delta: -1, targetCount: 1 },
  },

  // Host-choice (multi) — host taps everyone who messed up the group game.
  {
    id: 'setteBum',
    icon: '7️⃣',
    effect: { resolution: 'host-choice', delta: -1, targetCount: 'any' },
  },

  // Host-choice (single) — exactly one loser.
  {
    id: 'ventuno',
    icon: '2️⃣1️⃣',
    effect: { resolution: 'host-choice', delta: -1, targetCount: 1 },
  },

  // Host-choice (multi).
  {
    id: 'storia',
    icon: '📖',
    effect: { resolution: 'host-choice', delta: -1, targetCount: 'any' },
  },

  // Host-choice (multi).
  {
    id: 'zingBoing',
    icon: '🔄',
    effect: { resolution: 'host-choice', delta: -1, targetCount: 'any' },
  },
]

export const CARDS_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c])) as Record<
  string,
  CardDef
>

export function getCard(id: string): CardDef {
  const c = CARDS_BY_ID[id]
  if (!c) throw new Error(`Unknown card id: ${id}`)
  return c
}
