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

/**
 * Row of life glasses. If `hasJolly` is true an extra 🃏 token is rendered
 * after the shots, visually representing the "spare life" the player holds.
 */
export function LifeRow({
  lives,
  max,
  hasJolly = false,
}: {
  lives: number
  max: number
  hasJolly?: boolean
}) {
  return (
    <div
      className="flex gap-0.5 items-center"
      aria-label={`${lives} of ${max} shots remaining${hasJolly ? ', plus jolly token' : ''}`}
    >
      {Array.from({ length: max }).map((_, i) => (
        <LifeGlass key={i} filled={i < lives} />
      ))}
      {hasJolly && (
        <span
          role="img"
          aria-label="jolly token"
          title="Jolly token — absorbs the next lost shot"
          style={{ fontSize: '20px', lineHeight: 1, marginLeft: '2px' }}
        >
          🃏
        </span>
      )}
    </div>
  )
}
