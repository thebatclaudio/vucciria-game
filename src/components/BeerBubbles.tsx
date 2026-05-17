import { useMemo } from 'react'

/**
 * Beer-bubble background: white particles rising from the bottom of the
 * screen on an amber gradient. Pure CSS animation (cheap on mobile).
 */
export default function BeerBubbles({ count = 24 }: { count?: number }) {
  const bubbles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = 6 + Math.random() * 22
      const left = Math.random() * 100
      const delay = Math.random() * 8
      const duration = 6 + Math.random() * 8
      return { i, size, left, delay, duration }
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
          className="absolute bottom-[-40px] rounded-full bg-white/60 animate-bubble-rise"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size}px`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            boxShadow: '0 0 8px rgba(255,255,255,0.7)',
          }}
        />
      ))}
    </div>
  )
}
