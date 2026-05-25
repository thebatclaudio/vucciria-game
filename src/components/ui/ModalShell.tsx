import {
  useEffect,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react'

/**
 * Reusable modal chrome — extracted so PlayerPickerDialog and ConfirmDialog
 * don't each re-implement the overlay, focus-trap, and safe-area handling.
 *
 * Behaviour:
 *   - Renders a fullscreen `bg-black/50 backdrop-blur-sm` overlay.
 *   - Centers a white card on desktop; on mobile it docks to the bottom as
 *     a bottom sheet (`rounded-t-3xl`).
 *   - Moves focus into the dialog on mount; restores to the previously
 *     focused element on unmount (so the user's keyboard context isn't lost
 *     after a quick confirm).
 *   - Implements a minimal focus trap (Tab / Shift+Tab cycles within).
 *   - Optional Esc-to-close. Some callers (the mandatory player picker)
 *     intentionally swallow Esc — they pass `dismissible={false}`.
 *   - Optional backdrop click dismiss (same gating as Esc).
 *
 * The shell does NOT supply visuals beyond the chrome — title, body, and
 * actions are caller-owned children so each dialog can pick its own
 * spacing / typography / button arrangement.
 */
type Props = {
  open: boolean
  /** Called when user dismisses via Esc or backdrop click. */
  onDismiss?: () => void
  /**
   * When `false`, Esc and backdrop click are swallowed (the dialog can
   * only be closed by its own confirm/cancel actions). Defaults to `true`.
   */
  dismissible?: boolean
  /** Sets aria-labelledby on the dialog. Provide an id present in children. */
  labelledBy?: string
  /** Sets aria-describedby on the dialog. */
  describedBy?: string
  children: ReactNode
  /** Optional extra classes on the inner card (e.g. max-width override). */
  cardClassName?: string
  /** Optional inline style for the inner card (used for safe-area padding). */
  cardStyle?: CSSProperties
}

export default function ModalShell({
  open,
  onDismiss,
  dismissible = true,
  labelledBy,
  describedBy,
  children,
  cardClassName = '',
  cardStyle,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  // Focus management: store the currently-focused element on open so we
  // can restore it on close, then push focus into the dialog.
  useEffect(() => {
    if (!open) return
    lastFocusedRef.current = (document.activeElement as HTMLElement) ?? null
    // Defer to next microtask so the dialog content is in the DOM.
    queueMicrotask(() => {
      const root = dialogRef.current
      if (!root) return
      const first = root.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
      )
      ;(first ?? root).focus()
    })
    return () => {
      lastFocusedRef.current?.focus?.()
    }
  }, [open])

  // Keyboard: focus trap + optional Esc dismiss.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!dismissible) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        e.preventDefault()
        onDismiss?.()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
  }, [open, dismissible, onDismiss])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={
        dismissible
          ? (e) => {
              // Only fire dismiss when the user clicked the backdrop
              // itself, not a child element that bubbled up.
              if (e.target === e.currentTarget) onDismiss?.()
            }
          : undefined
      }
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        style={{
          paddingBottom: 'max(1.25rem, calc(1.25rem + var(--safe-b)))',
          ...cardStyle,
        }}
        className={`w-full sm:w-[28rem] max-w-md bg-white rounded-t-3xl sm:rounded-card shadow-elev-2 p-5 sm:p-6 flex flex-col gap-3 max-h-[85vh] overflow-hidden focus:outline-none ${cardClassName}`}
      >
        {children}
      </div>
    </div>
  )
}
