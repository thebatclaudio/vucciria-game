/**
 * Suspense fallback shown while a route-level lazy chunk is in flight.
 *
 * Why this exists:
 *   `src/App.tsx` lazy-loads every route via `React.lazy()` so that the
 *   game routes (Lobby/Play/GameOver and their yjs / framer-motion /
 *   qrcode subtrees) don't ship in the first-paint bundle. While the
 *   chunk downloads we need *some* placeholder so React's hydrated tree
 *   has a stable shape — but the persistent `<BeerBubbles />` background
 *   is already on screen behind `<main>`, so we keep this intentionally
 *   minimal: a small centered coffee-toned spinner.
 *
 * Accessibility:
 *   - `role="status"` + `aria-live="polite"` lets screen-readers
 *     announce the loading state once.
 *   - The visible label is hidden with `sr-only` so the layout doesn't
 *     reflow when the chunk arrives.
 *   - `@media (prefers-reduced-motion: reduce)` is honoured via
 *     `motion-safe:animate-spin` — users who opted out see a static
 *     ring instead of a rotating one.
 */
export default function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 items-center justify-center w-full py-12"
    >
      <span
        aria-hidden
        className="block h-10 w-10 rounded-full border-4 border-ink/15 border-t-accent motion-safe:animate-spin"
      />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
