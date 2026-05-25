import { createContext } from 'react'

/**
 * Shared types + context object for the toast system.
 *
 * Split out from `Toast.tsx` so the Fast Refresh lint rule
 * (react-refresh/only-export-components) stays happy: a file that
 * exports React components shouldn't also export hooks / constants /
 * type-only values. This file is .ts (not .tsx) and exports zero
 * components; `useToast` lives next to it in `useToast.ts`.
 */

export type ToastTone = 'info' | 'success' | 'warn' | 'danger'

export type ToastShowArgs = {
  message: string
  tone?: ToastTone
  durationMs?: number
}

export type ToastContextValue = {
  show: (args: ToastShowArgs) => void
  dismiss: () => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
