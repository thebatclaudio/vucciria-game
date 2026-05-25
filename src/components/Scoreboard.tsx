import NotoEmoji from '@/components/NotoEmoji'
import { LifeRow } from '@/components/LifeGlass'
import type { Player } from '@/game/types'

/**
 * Final ranking shown on the GameOver screen.
 *
 * Sort order:
 *   1. Winner (matched via `winnerPeerId`) first, regardless of lives —
 *      a host-side `endTurn` declares the winner explicitly and that
 *      decision wins over the raw lives count.
 *   2. Then by `lives` desc (survivors above the eliminated).
 *   3. Tiebreak by `seat` asc (stable ordering for snapshot equality).
 *
 * Dead players (lives === 0) get the standard `.life-glass-lost` greyed
 * row treatment so the eye can sweep "who's still standing." Winner row
 * also gets a 🏆 prefix and the accent ring to distinguish it from
 * survivors who happen to share the highest life count.
 */
type Props = {
  players: Player[]
  winnerPeerId: string | null
  startingLives: number
}

export default function Scoreboard({
  players,
  winnerPeerId,
  startingLives,
}: Props) {
  const ranked = [...players].sort((a, b) => {
    if (a.peerId === winnerPeerId) return -1
    if (b.peerId === winnerPeerId) return 1
    if (b.lives !== a.lives) return b.lives - a.lives
    return a.seat - b.seat
  })

  return (
    <ol className="w-full flex flex-col gap-2">
      {ranked.map((p, idx) => {
        const isWinner = p.peerId === winnerPeerId
        const isDead = p.lives <= 0
        return (
          <li
            key={p.peerId}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-surface ring-1 shadow-elev-1
              ${
                isWinner
                  ? 'bg-canvas/40 ring-accent'
                  : 'bg-white ring-ink/10'
              }
              ${isDead && !isWinner ? 'opacity-50' : ''}`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {/* Ranking digit — a quick "I came 3rd" affordance. */}
              <span
                aria-hidden
                className="w-6 text-center text-sm font-mono font-bold text-ink-soft tabular-nums"
              >
                {idx + 1}
              </span>
              <NotoEmoji emoji={p.emoji} size={28} animated={isWinner} />
              <span className="font-semibold truncate text-ink flex items-center gap-1">
                {isWinner && <span aria-hidden>🏆</span>}
                {p.nickname}
              </span>
            </span>
            <LifeRow lives={p.lives} max={startingLives} />
          </li>
        )
      })}
    </ol>
  )
}
