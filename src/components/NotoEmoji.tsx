import { lazy, Suspense, useEffect, useState } from 'react'
import {
  NO_LOTTIE,
  resolveLottieUrl,
  resolveSvgUrl,
  unicodeToCodepoint,
} from '@/assets/notoEmojiMap'

/**
 * `<DotLottieReact>` is ~80 KB of JS + WASM. We only need it when an avatar
 * is actually being animated (current-turn player, hero spots). Lazy-import
 * keeps it out of the first-paint bundle and out of the static picker grid
 * entirely.
 */
const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({
    default: m.DotLottieReact,
  })),
)

type Props = {
  /** The unicode emoji glyph (e.g. "🦊"). Wire format is preserved across the app. */
  emoji: string
  /** Pixel size for both width and height. */
  size: number
  /**
   * When `true`, render the animated Lottie if available. When `false` (the
   * default), render the static Noto SVG. Unknown / NO_LOTTIE emojis always
   * fall back to static; missing-asset failures fall back further to the
   * native unicode glyph in a `<span>`.
   */
  animated?: boolean
  /** Optional accessible label. Defaults to the emoji glyph itself. */
  'aria-label'?: string
  className?: string
}

/**
 * Detect `prefers-reduced-motion: reduce` and stay in sync with live changes.
 * Returns `false` during SSR / before mount (we have no SSR, but this keeps
 * the hook safe in tests).
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

/**
 * Render a Google Noto emoji at a fixed pixel size.
 *
 * Decision tree:
 *   1. If `animated` AND not in NO_LOTTIE AND no reduced-motion preference:
 *      render <DotLottieReact> (lazy-loaded, looping). On load error or
 *      mount failure, fall through to the static SVG.
 *   2. Otherwise: render the static `emoji.svg`.
 *   3. If even the SVG fails to load: render the native unicode glyph in a
 *      sized `<span>` (this is what the codebase did before this component).
 *
 * Performance notes:
 *   - Mount/unmount of the Lottie player is cheap (a single DOM node + a
 *     web component). Sites can freely toggle `animated` based on game
 *     state (e.g. `isCurrent` in PlayerCircle) without thrashing.
 *   - The PWA service worker (see vite.config.ts) caches CDN fetches with
 *     StaleWhileRevalidate so the long tail is offline-warm after first use.
 */
export default function NotoEmoji({
  emoji,
  size,
  animated = false,
  'aria-label': ariaLabel,
  className,
}: Props) {
  const reducedMotion = useReducedMotion()
  const [svgFailed, setSvgFailed] = useState(false)
  const [lottieFailed, setLottieFailed] = useState(false)

  const label = ariaLabel ?? emoji
  const wantAnimated =
    animated && !reducedMotion && !NO_LOTTIE.has(emoji) && !lottieFailed

  // Reset failure flags when the emoji changes — a fresh glyph deserves a
  // fresh chance.
  useEffect(() => {
    setSvgFailed(false)
    setLottieFailed(false)
  }, [emoji])

  // Final fallback: native unicode in a sized span. Same shape the codebase
  // used everywhere prior to this component.
  if (svgFailed) {
    return (
      <span
        className={className}
        role="img"
        aria-label={label}
        style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}
      >
        {emoji}
      </span>
    )
  }

  if (wantAnimated) {
    const lottieUrl = resolveLottieUrl(emoji)
    return (
      <Suspense
        fallback={
          <img
            src={resolveSvgUrl(emoji)}
            width={size}
            height={size}
            alt={label}
            className={className}
            draggable={false}
            onError={() => setSvgFailed(true)}
          />
        }
      >
        <DotLottieReact
          src={lottieUrl}
          autoplay
          loop
          style={{ width: size, height: size }}
          className={className}
          aria-label={label}
          role="img"
          // dotLottie-react surfaces a generic "error" event. We don't get
          // the underlying status, but any failure → demote to static SVG
          // for the rest of this component's lifetime.
          onError={() => setLottieFailed(true)}
          data-noto-cp={unicodeToCodepoint(emoji)}
        />
      </Suspense>
    )
  }

  return (
    <img
      src={resolveSvgUrl(emoji)}
      width={size}
      height={size}
      alt={label}
      className={className}
      draggable={false}
      onError={() => setSvgFailed(true)}
      data-noto-cp={unicodeToCodepoint(emoji)}
    />
  )
}
