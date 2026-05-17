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
  /**
   * Stable per-(tab, gameCode) application identity. Survives page refresh.
   * Used as the key in the Yjs `players` map. See `src/game/identity.ts`.
   *
   * NOTE: despite the name, this is NOT Trystero's wire-level peer id —
   * that is tracked separately in `trysteroPeerId` below, so we can map
   * a Trystero `onPeerLeave(trysteroPeerId)` callback back to the right
   * Yjs entry without leaking the unstable Trystero identity elsewhere.
   */
  peerId: string
  nickname: string
  emoji: string
  lives: number
  /** Monotonic seat assigned at join; turn order is by ascending seat. */
  seat: number
  /** When this peer joined, ms since epoch (used as fallback ordering). */
  joinedAt: number
  /**
   * Current Trystero (WebRTC wire) peer id for this player. Updated every
   * time the player rejoins (e.g. after a refresh). May be null briefly
   * before the player has been registered with their wire id, or for
   * stale entries that were rehydrated from IndexedDB.
   */
  trysteroPeerId?: string | null
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
