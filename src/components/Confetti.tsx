import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'

/**
 * One-shot confetti burst rendered with CSS animations only — no library,
 * no canvas. ~60 absolutely-positioned `<span>` elements that fall from
 * the top with a slight rotation. Pointer events disabled so it never
 * blocks the underlying CTA.
 *
 * Bounded by the parent's stacking context: place this inside the dialog
 * / overlay you want it to decorate. Honors `prefers-reduced-motion` by
 * rendering nothing — celebration motion is decorative and never carries
 * required information.
 */
export default function Confetti({ count = 60 }: { count?: number }) {
  const reduced = useReducedMotion()
  const pieces = useMemo(() => {
    if (reduced) return []
    return Array.from({ length: count }).map((_, i) => {
      const colors = ['#FBC02D', '#F9A825', '#5D2E14', '#2E7D32', '#B71C1C']
      return {
        i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.5 + Math.random() * 1.5,
        size: 6 + Math.random() * 8,
        rotateStart: Math.random() * 360,
        rotateEnd: Math.random() * 720 - 360,
        color: colors[i % colors.length],
        translateX: -20 + Math.random() * 40,
      }
    })
  }, [count, reduced])

  if (reduced) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {pieces.map((p) => (
        <span
          key={p.i}
          style={{
            position: 'absolute',
            top: '-20px',
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.4}px`,
            background: p.color,
            borderRadius: '2px',
            // Use inline @keyframes via animation-name + Tailwind's
            // global keyframes would require a config change. A custom
            // CSS animation defined in src/styles/index.css is the
            // cheapest route — see the `confetti-fall` keyframes there.
            animation: `confetti-fall ${p.duration}s cubic-bezier(0.16, 0.84, 0.44, 1) ${p.delay}s forwards`,
            transform: `translateX(${p.translateX}vw) rotate(${p.rotateStart}deg)`,
            // Pass the end rotation into the keyframes via a custom prop
            // so each piece spins to a different final angle.
            ['--confetti-rotate-end' as string]: `${p.rotateEnd}deg`,
          }}
        />
      ))}
    </div>
  )
}
