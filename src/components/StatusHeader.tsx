import NotoEmoji from '@/components/NotoEmoji'
import { LifeRow } from '@/components/LifeGlass'
import type { Player } from '@/game/types'

/**
 * Three-row status header for the Play screen.
 *
 * Replaces the single-line `<p>` that previously crammed turn + phase +
 * prompt + resolved-summary into one element with emoji-prefixed copy.
 *
 * Layout (top → bottom):
 *
 *   ┌───────────────────────────────────────────────────┐
 *   │ 👑 Avatar  Nickname (you)               🥃🥃🥃   │   ← who's playing
 *   │ ●  Awaiting draw                                  │   ← phase chip
 *   │    Tap the card to draw                           │   ← optional prompt
 *   └───────────────────────────────────────────────────┘
 *
 * The phase chip uses semantic colors so the player can tell at a glance
 * whether something is required from them (`accent`), from someone else
 * (`ink-soft`), or already resolved (`success`).
 */

export type PhaseChipTone = 'idle' | 'self' | 'waiting' | 'resolved'

type Props = {
  /** Player whose turn it currently is (drawer). Null if unknown. */
  drawer: Player | null
  /** Whether the local viewer is the drawer (used for "(you)" marker). */
  isDrawer: boolean
  /** Crown marker if drawer is the host. */
  isHost: boolean
  /** Max lives, used to anchor the LifeRow width. */
  startingLives: number
  /** Whether drawer holds the Jolly token (renders 🃏 trailing in the row). */
  hasJolly: boolean
  /** Short phase label (e.g. "Awaiting draw" / "Picking opponent"). */
  phaseLabel: string
  /** Semantic tone for the chip dot. */
  phaseTone: PhaseChipTone
  /** Optional second-line prompt (e.g. "Tap the card to draw"). */
  prompt?: string | null
}

const TONE_TO_CHIP: Record<PhaseChipTone, { dot: string; chip: string }> = {
  // "Idle" = our viewer has nothing to do but observe (other player's turn,
  // no input needed). Calm grey.
  idle: {
    dot: 'bg-ink-faint',
    chip: 'bg-white text-ink-soft ring-1 ring-ink/10',
  },
  // "Self" = action required from the local viewer. Accent draws the eye.
  self: {
    dot: 'bg-accent',
    chip: 'bg-canvas text-ink ring-1 ring-accent/40',
  },
  // "Waiting" = an action is required from another player (drawer / host).
  // Amber pulse signals "blocked, not by you."
  waiting: {
    dot: 'bg-warn animate-pulse',
    chip: 'bg-warn-soft text-ink ring-1 ring-warn/30',
  },
  // "Resolved" = phase finished, soft green so it feels like a checkmark.
  resolved: {
    dot: 'bg-success',
    chip: 'bg-success-soft text-ink ring-1 ring-success/30',
  },
}

export default function StatusHeader({
  drawer,
  isDrawer,
  isHost,
  startingLives,
  hasJolly,
  phaseLabel,
  phaseTone,
  prompt,
}: Props) {
  const tone = TONE_TO_CHIP[phaseTone]
  return (
    <div className="w-full flex flex-col gap-2 bg-white rounded-card p-3 ring-1 ring-ink/10 shadow-elev-1">
      {/* Row 1 — drawer identity + lives */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {drawer ? (
            <>
              <NotoEmoji emoji={drawer.emoji} size={32} animated />
              <span className="font-semibold text-ink truncate flex items-center gap-1">
                {isHost && <span aria-hidden>👑</span>}
                {drawer.nickname}
                {isDrawer && (
                  <span className="text-xs text-ink-soft font-normal">
                    (you)
                  </span>
                )}
              </span>
            </>
          ) : (
            <span className="text-ink-soft italic">—</span>
          )}
        </div>
        {drawer && (
          <LifeRow
            lives={drawer.lives}
            max={startingLives}
            hasJolly={hasJolly}
          />
        )}
      </div>

      {/* Row 2 — phase chip */}
      <div className="flex items-center">
        <span
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-chip text-xs font-semibold ${tone.chip}`}
        >
          <span
            aria-hidden
            className={`inline-block w-2 h-2 rounded-full ${tone.dot}`}
          />
          {phaseLabel}
        </span>
      </div>

      {/* Row 3 — optional prompt */}
      {prompt && (
        <p className="text-sm text-ink-soft leading-snug">{prompt}</p>
      )}
    </div>
  )
}
