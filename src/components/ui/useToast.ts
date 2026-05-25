import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from './toastContext'

/**
 * Hook used by callers to surface a toast. Throws if not wrapped in a
 * `<ToastProvider>` so misuse fails loudly instead of silently no-oping.
 *
 * Lives in its own .ts file (not .tsx) so the Fast Refresh lint rule
 * (`react-refresh/only-export-components`) stays clean: the file with
 * the JSX `<ToastProvider>` only exports components, this one only
 * exports the hook, and they share the typed context via
 * `./toastContext`.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}
