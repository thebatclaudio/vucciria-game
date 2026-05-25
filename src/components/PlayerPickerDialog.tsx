import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import NotoEmoji from '@/components/NotoEmoji'
import { LifeRow } from '@/components/LifeGlass'
import { PrimaryButton } from '@/components/ui/Button'
import ModalShell from '@/components/ui/ModalShell'
import type { Player } from '@/game/types'

export type PickerMode = 'single' | 'multi'

type Props = {
  open: boolean
  /** Dialog title shown at the top. */
  title: string
  /** Optional sub-heading (e.g. card title or short instruction). */
  subtitle?: string
  /** Players the picker may choose from. Already filtered (alive, allowed). */
  candidates: Player[]
  /** Currently-selected peerIds (controlled). */
  selection: string[]
  /** Called when the user taps a row to toggle that peerId. */
  onToggle: (peerId: string) => void
  /** Single: must select exactly one. Multi: any count allowed (0..n). */
  mode: PickerMode
  /**
   * For `multi` mode, set to `true` if zero selections are allowed
   * (host-choice with targetCount: 'any'). Defaults to `false`.
   */
  allowEmpty?: boolean
  /** Called when the user confirms the pick. */
  onConfirm: () => void
  /** Currently-highlighted player (e.g. the drawer for context). */
  highlightPeerId?: string | null
}

/**
 * Modal dialog that forces the chooser (drawer or host) to explicitly
 * select target player(s) before the game can advance.
 *
 * Mandatory: there is no Cancel button, no Esc handler, no backdrop
 * dismiss. The dialog stays mounted until the parent's `open` prop flips
 * (which happens only when the underlying `cardPhase` advances after a
 * successful confirmation). This is enforced via `dismissible={false}` on
 * the underlying `<ModalShell>`.
 *
 * The shell handles focus management, focus trap, safe-area inset, and
 * the overlay chrome — this component only owns the dialog content.
 */
export default function PlayerPickerDialog({
  open,
  title,
  subtitle,
  candidates,
  selection,
  onToggle,
  mode,
  allowEmpty = false,
  onConfirm,
  highlightPeerId,
}: Props) {
  const { t } = useTranslation()

  const canConfirm = useMemo(() => {
    if (mode === 'single') return selection.length === 1
    return allowEmpty ? true : selection.length >= 1
  }, [selection.length, mode, allowEmpty])

  const isSelected = (peerId: string): boolean => selection.includes(peerId)

  return (
    <ModalShell
      open={open}
      dismissible={false}
      labelledBy="player-picker-title"
    >
      <h2
        id="player-picker-title"
        className="text-xl sm:text-2xl font-bold text-ink text-center"
      >
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-ink-soft text-center -mt-1">{subtitle}</p>
      )}

      {mode === 'multi' && (
        <p className="text-xs text-ink-soft text-center">
          {t('play.dialog.selectCount', {
            count: selection.length,
          })}
        </p>
      )}

      <ul className="flex flex-col gap-2 overflow-y-auto py-1 -mx-1 px-1">
        {candidates.map((p) => {
          const selected = isSelected(p.peerId)
          const isHighlight = highlightPeerId === p.peerId
          return (
            <li key={p.peerId}>
              <button
                type="button"
                onClick={() => onToggle(p.peerId)}
                aria-pressed={selected}
                className={`w-full flex items-center justify-between gap-3 rounded-surface px-4 py-3 text-left transition border-2 min-h-[3rem]
                  ${
                    selected
                      ? 'bg-accent border-accent text-white'
                      : 'bg-white border-transparent text-ink hover:border-accent'
                  }
                  ${isHighlight ? 'ring-2 ring-accent' : ''}
                `}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <NotoEmoji emoji={p.emoji} size={32} />
                  <span className="font-semibold truncate">
                    {p.nickname}
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <LifeRow lives={p.lives} max={p.lives} />
                  {selected && <span aria-hidden>✅</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <PrimaryButton
        onClick={onConfirm}
        disabled={!canConfirm}
        className="mt-2"
      >
        {t('play.dialog.confirm')}
      </PrimaryButton>
    </ModalShell>
  )
}
