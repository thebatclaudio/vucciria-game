import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { registerSW } from 'virtual:pwa-register'

/**
 * Bridges the Workbox service worker (configured in vite.config.ts) with the
 * UI. Responsibilities:
 *
 *  1. Register the SW on mount (with `immediate: true` so it activates as
 *     soon as the page loads — important on mobile where users rarely keep
 *     long-lived tabs open).
 *  2. Poll for updates whenever the tab regains focus or becomes visible.
 *     Mobile browsers throttle background timers aggressively, so a periodic
 *     `setInterval` is unreliable; "user came back to the app" is the most
 *     dependable signal we can hook into.
 *  3. When a new SW finishes installing and is waiting, surface a toast that
 *     lets the user opt into the refresh. Tapping "Refresh" calls
 *     `updateSW(true)`, which posts SKIP_WAITING to the new SW. The browser
 *     then fires `controllerchange`, and we reload the page exactly once.
 *
 * Why not auto-reload silently? The user requested a toast UX so an
 * in-progress game isn't yanked out from under them.
 */
export default function PwaUpdateToast() {
  const { t } = useTranslation()
  const [needRefresh, setNeedRefresh] = useState(false)
  // `registerSW` returns the function used to *trigger* the update. We store
  // it in a ref so the toast button can call it without re-running the effect.
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        // Best-effort update check; swallow errors (offline, CORS, etc.) —
        // the next focus event will retry.
        const check = () => {
          void registration.update().catch(() => {})
        }
        const onVisibility = () => {
          if (document.visibilityState === 'visible') check()
        }
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('focus', check)
        // The component is mounted once at the app root and lives for the
        // page lifetime, so we don't bother cleaning these up.
      },
    })
    updateSWRef.current = updateSW

    // When the new SW takes control (after the user accepts the update),
    // reload exactly once so the in-memory JS bundle matches the cache.
    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    )

    return () => {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      )
    }
  }, [])

  if (!needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 inset-x-0 z-[100] flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-amber-500 text-white shadow-lg px-4 py-2">
        <span className="text-sm">{t('pwa.updateAvailable')}</span>
        <button
          type="button"
          onClick={() => void updateSWRef.current?.(true)}
          className="rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1 text-sm font-semibold transition-colors"
        >
          {t('pwa.refresh')}
        </button>
        <button
          type="button"
          aria-label={t('pwa.later')}
          onClick={() => setNeedRefresh(false)}
          className="text-white/80 hover:text-white text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    </div>
  )
}
