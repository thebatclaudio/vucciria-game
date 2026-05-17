import type { CardDef } from './types'

/**
 * The 13 cards of VucciriaGame.
 *
 * Each card's user-facing title and description live in `src/i18n/{en,it}.json`
 * under `cards.<id>.title` and `cards.<id>.desc`.
 */
export const CARDS: CardDef[] = [
  { id: 'mossa', icon: '🕺', type: 'mossa', affects: 'all' },
  { id: 'bevi', icon: '🍺', type: 'auto', affects: 'self' },
  { id: 'beviOoffri', icon: '🎁', type: 'choice', affects: 'chosen' },
  { id: 'treAveMaria', icon: '👥', type: 'auto', affects: 'neighbors' },
  { id: 'tuEcumpari', icon: '🤝', type: 'choice', affects: 'chosen' },
  { id: 'jolly', icon: '🃏', type: 'auto', affects: 'self' },
  { id: 'pipi', icon: '🚽', type: 'auto', affects: 'self' },
  { id: 'sfida', icon: '⚔️', type: 'minigame', affects: 'chosen' },
  { id: 'setteBum', icon: '7️⃣', type: 'minigame', affects: 'group' },
  { id: 'ventuno', icon: '2️⃣1️⃣', type: 'minigame', affects: 'group' },
  { id: 'storia', icon: '📖', type: 'minigame', affects: 'group' },
  { id: 'zingBoing', icon: '🔄', type: 'minigame', affects: 'group' },
  { id: 'bevonoTutti', icon: '🍻', type: 'auto', affects: 'all' },
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
