import { LifeRow } from './LifeGlass'
import type { Player } from '@/game/types'

/**
 * Render players arranged in a horizontal flex (mobile) or in a ring on
 * wider screens. Highlights the current-turn player and dims the eliminated.
 */
export default function PlayerCircle({
  players,
  currentSeat,
  hostPeerId,
  selfPeerId,
  startingLives,
}: {
  players: Player[]
  currentSeat: number
  hostPeerId: string
  selfPeerId: string
  startingLives: number
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {players.map((p) => {
        const isCurrent = p.seat === currentSeat
        const isSelf = p.peerId === selfPeerId
        const isHost = p.peerId === hostPeerId
        const isDead = p.lives <= 0
        return (
          <div
            key={p.peerId}
            className={`flex flex-col items-center p-2 rounded-xl min-w-[80px] transition ${
              isCurrent
                ? 'bg-beer-200 ring-2 ring-beer-600 scale-105'
                : 'bg-white/70'
            } ${isDead ? 'opacity-50' : ''}`}
          >
            <span className="text-3xl">{p.emoji}</span>
            <span className="text-xs font-semibold truncate max-w-[80px]">
              {p.nickname}
              {isSelf && ' ⭐'}
              {isHost && ' 👑'}
            </span>
            <LifeRow lives={Math.max(0, p.lives)} max={startingLives} />
          </div>
        )
      })}
    </div>
  )
}
