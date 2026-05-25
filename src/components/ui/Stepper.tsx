import type { ReactNode } from 'react'

/**
 * Numeric stepper rendered as a pair of circular − / + buttons.
 *
 * The numeric value itself is intentionally NOT rendered by this
 * component. Instead, the caller passes the visible read-out as
 * `children`, which Stepper sandwiches between the − and + buttons:
 *
 *   [−]  {children}  [+]
 *
 * That gives the caller full control over the read-out's appearance
 * (in CreateGame it's a row of shot-glass emoji via `LifeRow`) while
 * Stepper guarantees the canonical layout, tap targets, and a11y.
 *
 * Sizing notes:
 *   - Both buttons are 44 × 44 px so they clear the iOS tap-target
 *     guidance.
 *
 * Accessibility:
 *   - `role="group"` + an optional `aria-label` group the two buttons
 *     and the read-out as one composite control.
 *   - An off-screen `aria-live="polite"` region announces the current
 *     value (with `valueLabel`, when provided) so screen-reader users
 *     hear "3 lives" / "4 lives" while stepping, regardless of how
 *     the visible read-out (`children`) is rendered.
 */
type Props = {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  /**
   * Visible read-out rendered between the − and + buttons. Typically
   * a domain-specific visualization of `value` (e.g. a `LifeRow` of
   * shot-glass emoji). Stepper does not interpret it.
   */
  children?: ReactNode
  /**
   * Optional descriptive label appended to the announced value
   * (e.g. "lives"). Used only for the off-screen live region; if you
   * omit it, only the raw number is announced.
   */
  valueLabel?: string
  /** Optional aria-label for the whole control. */
  ariaLabel?: string
}

export default function Stepper({
  value,
  min,
  max,
  onChange,
  children,
  valueLabel,
  ariaLabel,
}: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // `w-full` + `justify-between` pins − to the far left, + to the
      // far right, and lets the read-out (`children`) sit centered
      // between them. The two buttons stay `shrink-0` so they keep
      // their 44px tap targets even when the read-out is wide.
      className="flex w-full items-center justify-between gap-3"
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease"
        className="shrink-0 w-11 h-11 rounded-full bg-accent text-white text-xl font-bold
                   shadow-elev-1 transition active:scale-95
                   hover:bg-accent-hover
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                   focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        −
      </button>
      {/* Visible read-out slot. Centers between the two buttons. */}
      <div className="flex items-center justify-center">{children}</div>
      {/* Off-screen value announcer. The visible count lives in
          `children`, but assistive tech still needs to hear the value
          as it changes — `aria-live="polite"` queues an announcement
          on every step. */}
      <span aria-live="polite" className="sr-only">
        {valueLabel ? `${value} ${valueLabel}` : value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase"
        className="shrink-0 w-11 h-11 rounded-full bg-accent text-white text-xl font-bold
                   shadow-elev-1 transition active:scale-95
                   hover:bg-accent-hover
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                   focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        +
      </button>
    </div>
  )
}
