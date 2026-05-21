import { LifeRow } from './LifeGlass'
import type { Player } from '@/game/types'

/**
 * Picker mode for the player circle. Drives which avatars are tappable.
 *
 * - `none`   — read-only display (default).
 * - `single` — exactly one selection; tap-to-replace.
 * - `multi`  — zero-or-more selections; tap to toggle.
 *
 * `candidateIds` constrains which players can be picked (e.g. `sfida`
 * host step: only {drawer, opponent}). If undefined, all alive players
 * are candidates.
 */
export type PickerMode = 'none' | 'single' | 'multi'

/**
 * Render players arranged in a horizontal flex (mobile) or in a ring on
 * wider screens. Highlights the current-turn player and dims the eliminated.
 *
 * When `picker.mode !== 'none'` and the viewer is the relevant chooser,
 * eligible avatars become tappable. Selected avatars get a green ring.
 */
export default function PlayerCircle({
  players,
  currentSeat,
  hostPeerId,
  selfPeerId,
  startingLives,
  showingCard = false,
  jollyHolderId = null,
  picker,
}: {
  players: Player[]
  currentSeat: number
  hostPeerId: string
  selfPeerId: string
  startingLives: number
  showingCard?: boolean
  jollyHolderId?: string | null
  picker?: {
    mode: PickerMode
    candidateIds?: string[]
    selectedIds: string[]
    onToggle: (peerId: string) => void
  }
}) {
  const candidates = picker?.candidateIds
  const isCandidate = (p: Player) => {
    if (!picker || picker.mode === 'none') return false
    if (p.lives <= 0) return false
    if (candidates && !candidates.includes(p.peerId)) return false
    return true
  }

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {players.map((p) => {
        const isCurrent = p.seat === currentSeat
        const isSelf = p.peerId === selfPeerId
        const isHost = p.peerId === hostPeerId
        const isDead = p.lives <= 0
        const hasJolly = p.peerId === jollyHolderId
        const selectable = isCandidate(p)
        const isSelected =
          picker?.selectedIds.includes(p.peerId) ?? false

        const baseRing = isCurrent
          ? 'bg-beer-200 ring-2 ring-beer-600 scale-105'
          : 'bg-white/70'
        const pickerRing = isSelected
          ? 'ring-4 ring-green-500'
          : selectable
            ? 'ring-2 ring-blue-400 cursor-pointer hover:scale-105'
            : ''

        const handleClick = selectable
          ? () => picker?.onToggle(p.peerId)
          : undefined

        return (
          <div
            key={p.peerId}
            onClick={handleClick}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            onKeyDown={
              selectable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      picker?.onToggle(p.peerId)
                    }
                  }
                : undefined
            }
            className={`flex flex-col items-center p-2 rounded-xl min-w-[80px] transition relative ${baseRing} ${pickerRing} ${
              isDead ? 'opacity-50' : ''
            }`}
          >
            {isCurrent && showingCard && (
              <span className="absolute -top-1 -right-1 text-xl" title="Showing card">
                🎴
              </span>
            )}
            {isSelected && (
              <span
                className="absolute -top-1 -left-1 text-xl"
                title="Selected"
              >
                ✅
              </span>
            )}
            <span className="text-3xl">{p.emoji}</span>
            <span className="text-xs font-semibold truncate max-w-[80px]">
              {p.nickname}
              {isSelf && ' ⭐'}
              {isHost && ' 👑'}
            </span>
            <LifeRow
              lives={Math.max(0, p.lives)}
              max={startingLives}
              hasJolly={hasJolly}
            />
          </div>
        )
      })}
    </div>
  )
}
