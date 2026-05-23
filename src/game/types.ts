/**
 * Core game types.
 *
 * `lives` is just a non-negative integer. The UI renders each life as a
 * shot glass 🥃 (full color = alive, dimmed/greyscale = lost).
 */

/**
 * How a card resolves once drawn.
 *
 * - `auto`     — effect applies immediately to a deterministic target set
 *                (drawer / neighbors / everyone) with no human input.
 * - `drawer-choice` — the drawer picks one target on the player circle.
 * - `host-choice`  — the host picks one or more losers (for minigames).
 * - `duel`     — two-step: drawer picks the opponent, then the host picks
 *                the loser among {drawer, opponent}.
 * - `manual`   — card is shown but no automatic life mutation; the host
 *                may use the override panel if needed (e.g. `mossa`).
 */
export type CardResolution =
  | 'auto'
  | 'drawer-choice'
  | 'host-choice'
  | 'duel'
  | 'manual'

/**
 * Number of targets the picker must select.
 *
 * - `1`     — exactly one target.
 * - `'any'` — zero or more (the host may declare "no one lost").
 */
export type CardTargetCount = 1 | 'any'

/**
 * Serializable effect spec for a card. Lives next to the card definition
 * so the resolution rules stay in one place and can be exercised by pure
 * unit tests.
 */
export interface CardEffect {
  resolution: CardResolution
  /** Applied to each resolved target. Negative = lose a shot. */
  delta: number
  /** Optional additional delta applied to the drawer. */
  drawerDelta?: number
  /** For `auto` cards only — who the targets are. */
  autoTarget?: 'self' | 'neighbors' | 'all'
  /** For `host-choice` (and the host step of `duel`) only. */
  targetCount?: CardTargetCount
  /** `jolly` sets this; takes the token away from any previous holder. */
  grantsJolly?: boolean
}

/** A single card in the deck. `id` is the translation key suffix. */
export interface CardDef {
  id: string
  icon: string
  effect: CardEffect
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

/**
 * Where we are in the resolution flow of the currently-drawn card.
 *
 * - `awaiting-draw`        — no card on the table; current player must draw.
 * - `awaiting-drawer-pick` — drawer must tap a target (drawer-choice or
 *                            the first step of a duel).
 * - `awaiting-host-pick`   — host must declare the loser(s) (host-choice
 *                            or the second step of a duel).
 * - `resolved`             — effect applied; current player can end the turn.
 */
export type CardPhase =
  | 'awaiting-draw'
  | 'awaiting-drawer-pick'
  | 'awaiting-host-pick'
  | 'resolved'

export interface GameMeta {
  code: string
  name: string
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
  /** Current resolution phase for the in-flight card. */
  cardPhase: CardPhase
  /**
   * Drawer's picks waiting for host resolution. Used by the `duel` flow:
   * the drawer writes the opponent's peerId here, then the host reads it
   * and picks the loser among {drawer, opponent}. Reset to [] each turn.
   */
  pendingChosenIds: string[]
  /**
   * Player currently holding the Jolly token (one "spare life"). Drawing
   * `jolly` transfers the token to the drawer (any previous holder simply
   * loses it). The next `-1` to the holder consumes the token instead of
   * decrementing `lives`. Cleared when the holder leaves or is kicked.
   */
  jollyHolderId: string | null
}
