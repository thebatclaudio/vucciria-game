/**
 * Numeric stepper with two circular buttons + a visible numeric value.
 *
 * Replaces the previous 32px ad-hoc +/− buttons in CreateGame so that
 *   (a) every interactive control hits the iOS 44pt tap target, and
 *   (b) the user sees the current numeric value instead of having to
 *       count emoji on screen.
 *
 * Visual layout (left → right):
 *   [−]  3 lives  [+]
 * The label is intentionally inside the control so the affordance is one
 * compact unit.
 */
type Props = {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  /** Label rendered next to the numeric value (e.g. "lives"). */
  label: string
  /** Optional aria-label for the whole control. */
  ariaLabel?: string
}

export default function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  ariaLabel,
}: Props) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-3"
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrease"
        className="w-11 h-11 rounded-full bg-accent text-white text-xl font-bold
                   shadow-elev-1 transition active:scale-95
                   hover:bg-accent-hover
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
                   focus-visible:ring-offset-2 focus-visible:ring-offset-canvas
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        −
      </button>
      <span
        aria-live="polite"
        className="min-w-[6ch] text-center font-semibold text-ink tabular-nums"
      >
        {value} {label}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increase"
        className="w-11 h-11 rounded-full bg-accent text-white text-xl font-bold
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
