import { useEffect, useMemo, useState } from 'react'

/**
 * Rising-bubbles background, tuned to mimic the particles.js layer from the
 * old vucciria-game-pwa (Angular) build: white circles rising on a warm
 * yellow canvas, random size and opacity, no line-linking.
 *
 * Reference config (decoded from the old bundle):
 *   particles.number.value = 400, density area 1240
 *   color #ffffff, shape circle, size 15 (random)
 *   opacity ~0.75 (random)
 *   move.direction "top", move.speed 3, random + straight, out_mode "out"
 *
 * We use pure CSS instead of canvas:
 *   - Zero JS bundle cost beyond this tiny component
 *   - Cheap on mobile (no canvas paint, no GPU upload of particle textures)
 *   - The `bubble-rise` keyframe in tailwind.config.ts handles the motion
 *
 * The count is intentionally lower than 400 because each CSS particle costs
 * roughly 10x what a single canvas dot does (layout + composite), and on a
 * 360-wide mobile screen ~100–140 bubbles already reads as a dense field.
 *
 * Accessibility: when the user has `prefers-reduced-motion: reduce` set,
 * we drop the animation class so the bubbles freeze in place. They stay
 * visible as static dots — preserving the texture of the canvas without
 * the perpetual motion that can trigger vestibular discomfort. We listen
 * for live changes (e.g. iOS Settings flip while the app is open) and
 * re-render accordingly.
 */
export default function BeerBubbles({ count = 120 }: { count?: number }) {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    // Modern browsers expose addEventListener; older Safari only addListener.
    // Use addEventListener when available; fall back silently otherwise.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    // Legacy Safari (≤ 13) only exposes addListener / removeListener. Cast
    // to a structural type that has both so TS doesn't complain.
    const legacy = mq as MediaQueryList & {
      addListener?: (h: (e: MediaQueryListEvent) => void) => void
      removeListener?: (h: (e: MediaQueryListEvent) => void) => void
    }
    legacy.addListener?.(handler)
    return () => {
      legacy.removeListener?.(handler)
    }
  }, [])

  const bubbles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      // Size range tuned to the old PWA's "size: 15, random: true" — its
      // randomizer effectively yields ~1–15px; we widen slightly so the
      // larger blobs read on big screens.
      const size = 4 + Math.random() * 24
      const left = Math.random() * 100
      const delay = Math.random() * 12
      const duration = 6 + Math.random() * 8
      const opacity = 0.55 + Math.random() * 0.35
      // Reduced-motion freeze: distribute statically up the page instead
      // of all sitting at the bottom (which would look like a row of dots).
      const top = Math.random() * 100
      return { i, size, left, delay, duration, opacity, top }
    })
  }, [count])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {bubbles.map((b) => (
        <span
          key={b.i}
          className={
            reduced
              ? 'absolute rounded-full bg-white'
              : 'absolute bottom-[-40px] rounded-full bg-white animate-bubble-rise'
          }
          style={
            reduced
              ? {
                  left: `${b.left}%`,
                  top: `${b.top}%`,
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  opacity: b.opacity,
                  boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
                }
              : {
                  left: `${b.left}%`,
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  opacity: b.opacity,
                  animationDelay: `${b.delay}s`,
                  animationDuration: `${b.duration}s`,
                  // Softer halo than v1 so the particles read closer to
                  // the old PWA's flat circles instead of a glowy bubble.
                  boxShadow: '0 0 4px rgba(255, 255, 255, 0.5)',
                }
          }
        />
      ))}
    </div>
  )
}
