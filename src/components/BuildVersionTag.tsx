/**
 * Tiny non-interactive footer showing the build version (short Git SHA on CI,
 * `dev` locally). Lets us verify on a phone — without opening DevTools —
 * whether the deployed SW has actually picked up the latest commit.
 *
 * `__APP_VERSION__` is a compile-time constant injected by `define` in
 * vite.config.ts and typed in src/vite-env.d.ts.
 */
export default function BuildVersionTag() {
  return (
    <div
      aria-hidden
      className="fixed bottom-1 right-2 z-40 text-[10px] font-mono text-amber-900/40 select-none pointer-events-none"
    >
      v{__APP_VERSION__}
    </div>
  )
}
