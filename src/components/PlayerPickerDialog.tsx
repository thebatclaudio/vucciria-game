import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import NotoEmoji from '@/components/NotoEmoji'
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
 * successful confirmation).
 *
 * Accessibility: role="dialog", aria-modal, focus is moved to the dialog
 * on open, and Tab is contained within it via a minimal focus trap.
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
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  const canConfirm = useMemo(() => {
    if (mode === 'single') return selection.length === 1
    return allowEmpty ? true : selection.length >= 1
  }, [selection.length, mode, allowEmpty])

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return
    const target = firstButtonRef.current ?? dialogRef.current
    target?.focus()
  }, [open])

  // Minimal focus trap: Tab/Shift+Tab cycles within the dialog. Esc is
  // intentionally swallowed (mandatory pick).
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [open])

  if (!open) return null

  const isSelected = (peerId: string): boolean => selection.includes(peerId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      // Backdrop click is intentionally ignored — pick is mandatory.
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-picker-title"
        tabIndex={-1}
        className="w-full sm:w-[28rem] max-w-md bg-beer-50 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col gap-3 max-h-[85vh] overflow-hidden focus:outline-none"
      >
        <h2
          id="player-picker-title"
          className="text-xl sm:text-2xl font-bold text-beer-800 text-center"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-beer-700 text-center -mt-1">{subtitle}</p>
        )}

        {mode === 'multi' && (
          <p className="text-xs text-beer-600 text-center">
            {t('play.dialog.selectCount', {
              count: selection.length,
            })}
          </p>
        )}

        <ul className="flex flex-col gap-2 overflow-y-auto py-1 -mx-1 px-1">
          {candidates.map((p, idx) => {
            const selected = isSelected(p.peerId)
            const isHighlight = highlightPeerId === p.peerId
            return (
              <li key={p.peerId}>
                <button
                  ref={idx === 0 ? firstButtonRef : undefined}
                  type="button"
                  onClick={() => onToggle(p.peerId)}
                  aria-pressed={selected}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition border-2
                    ${
                      selected
                        ? 'bg-green-100 border-green-500'
                        : 'bg-white border-transparent hover:border-beer-400'
                    }
                    ${isHighlight ? 'ring-2 ring-beer-500' : ''}
                  `}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <NotoEmoji emoji={p.emoji} size={32} />
                    <span className="font-semibold text-beer-900 truncate">
                      {p.nickname}
                    </span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: p.lives }).map((_, i) => (
                      <span key={i}>🥃</span>
                    ))}
                    {selected && <span className="ml-2 text-green-700">✅</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="mt-2 px-6 py-3 rounded-xl bg-beer-700 hover:bg-beer-800 disabled:bg-beer-300 disabled:cursor-not-allowed text-white font-bold shadow-lg"
        >
          {t('play.dialog.confirm')}
        </button>
      </div>
    </div>
  )
}
