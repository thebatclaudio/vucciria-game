/**
 * Core game types.
 *
 * `lives` is just a non-negative integer. The UI renders each life as a
 * shot glass 🥃 (full color = alive, dimmed/greyscale = lost).
 */

export type CardType = 'auto' | 'choice' | 'minigame' | 'mossa'

/** A single card in the deck. `id` is the translation key suffix. */
export interface CardDef {
  id: string
  icon: string
  type: CardType
  /** Pure functions only — keep this serializable. */
  affects: 'self' | 'neighbors' | 'all' | 'chosen' | 'group'
}

export interface Player {
  peerId: string
  nickname: string
  emoji: string
  lives: number
  /** Monotonic seat assigned at join; turn order is by ascending seat. */
  seat: number
  /** When this peer joined, ms since epoch (used as fallback ordering). */
  joinedAt: number
}

export type GameStatus = 'lobby' | 'playing' | 'over'

export interface GameMeta {
  code: string
  name: string
  maxPlayers: number
  startingLives: number
  location: string | null
  hostPeerId: string
  status: GameStatus
  /** Index into players array (sorted by seat) of the player whose turn it is. */
  turnSeat: number
  /** ms since epoch */
  createdAt: number
  /** Id of the last drawn card; null at game start. */
  lastCardId: string | null
  /** Set when status === 'over'. */
  winnerPeerId: string | null
}
