import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ToastContext,
  type ToastContextValue,
  type ToastTone,
} from './toastContext'

/**
 * Single-slot toast system — provider + host.
 *
 * Why a single slot:
 *   - Mobile real estate is scarce; stacking 3+ toasts pushes the sticky
 *     action bar out of reach.
 *   - The product surfaces are simple — clipboard, kick, reconnect — and
 *     none of them need to coexist. Newer toasts replace older ones so
 *     the most recent feedback always wins.
 *
 * Behaviour:
 *   - `show({ message, tone, durationMs })` displays a pill bottom-center.
 *   - Auto-dismisses after `durationMs` (default 3000ms).
 *   - `tone` selects styling: `info` (accent/dark), `success` (green),
 *     `warn` (amber), `danger` (red).
 *   - role="status" + aria-live="polite" announce the message to screen
 *     readers without stealing focus.
 *
 * The `useToast` hook lives in `./useToast.ts` and the context object in
 * `./toastContext.ts` so this file only exports React components — keeps
 * the Fast Refresh lint rule happy.
 *
 * Mounted once at the App root via <ToastProvider> + <ToastHost />.
 */

type ToastSpec = {
  id: number
  message: string
  tone: ToastTone
  durationMs: number
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastSpec | null>(null)
  const nextIdRef = useRef(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const show = useCallback<ToastContextValue['show']>(
    ({ message, tone = 'info', durationMs = 3000 }) => {
      clearTimer()
      const id = nextIdRef.current++
      setToast({ id, message, tone, durationMs })
      timerRef.current = setTimeout(() => {
        setToast((cur) => (cur?.id === id ? null : cur))
        timerRef.current = null
      }, durationMs)
    },
    [clearTimer],
  )

  // Clean up the pending timer if the provider itself unmounts (test
  // teardown, route swap, etc.).
  useEffect(() => () => clearTimer(), [clearTimer])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastHost toast={toast} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

const TONE_TO_CHIP: Record<ToastTone, string> = {
  info: 'bg-accent text-white',
  success: 'bg-success text-white',
  warn: 'bg-warn text-white',
  danger: 'bg-danger text-white',
}

function ToastHost({
  toast,
  onDismiss,
}: {
  toast: ToastSpec | null
  onDismiss: () => void
}) {
  if (!toast) return null
  return (
    <div
      role="status"
      aria-live="polite"
      // Sits below the PWA update toast (z-100) but above the sticky
      // action bar (z-30) and anything else in the page.
      className="fixed inset-x-0 z-[90] flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'calc(5.5rem + var(--safe-b))' }}
    >
      <button
        type="button"
        onClick={onDismiss}
        className={`pointer-events-auto inline-flex items-center gap-2 max-w-md rounded-chip px-4 py-2 text-sm font-semibold shadow-elev-2 transition active:scale-[0.98] ${TONE_TO_CHIP[toast.tone]}`}
        aria-label="Dismiss notification"
      >
        <span>{toast.message}</span>
        <span aria-hidden className="text-white/70">×</span>
      </button>
    </div>
  )
}
