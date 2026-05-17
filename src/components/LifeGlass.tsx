/**
 * A single life, rendered as a shot glass.
 *
 * - filled: full color 🥃
 * - !filled: same emoji, dimmed/greyscale via CSS (`.life-glass-lost`)
 *
 * Using the same character with a CSS filter guarantees consistent
 * rendering across all platforms (some don't have a "pouring glass" emoji).
 */
export default function LifeGlass({
  filled,
  size = 24,
}: {
  filled: boolean
  size?: number
}) {
  return (
    <span
      role="img"
      aria-label={filled ? 'shot remaining' : 'shot lost'}
      className={filled ? '' : 'life-glass-lost'}
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
    >
      🥃
    </span>
  )
}

export function LifeRow({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${lives} of ${max} shots remaining`}>
      {Array.from({ length: max }).map((_, i) => (
        <LifeGlass key={i} filled={i < lives} />
      ))}
    </div>
  )
}
