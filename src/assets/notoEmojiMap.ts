/**
 * Helpers for mapping unicode emoji glyphs to Google Noto animated emoji
 * assets, served from `https://fonts.gstatic.com/s/e/notoemoji/latest`.
 *
 * Noto's URL convention: hyphen-joined lowercase hex codepoints, e.g.
 *   '🦊'     → '1f98a'
 *   '7️⃣'    → '0037-fe0f-20e3'
 *   '👨‍👩‍👧'  → '1f468-200d-1f469-200d-1f467'
 *
 * Two asset shapes:
 *   - `lottie.json`  — animated, ~70% coverage (gaps listed in NO_LOTTIE)
 *   - `emoji.svg`    — static, ~100% coverage (used as fallback)
 *
 * NO_LOTTIE is hand-seeded from `scripts/audit-noto.mjs` against the current
 * EMOJIS catalog. Re-run that script when the catalog changes.
 */

/**
 * Convert a unicode emoji glyph to its Noto codepoint slug.
 *
 * Uses string iteration (not `.charCodeAt`) so surrogate pairs collapse into
 * the single astral code point Noto expects. ZWJ (`200d`) and mid-sequence
 * variation selectors (`fe0f`) are preserved and joined with `-`.
 *
 * Noto's CDN URL convention drops a TRAILING `-fe0f` for simple
 * "base + variation selector" emojis like `☀️` (`2600-fe0f` → `2600`),
 * `🌧️` (`1f327-fe0f` → `1f327`), `🕹️`, `🖌️`, `🌤️`. We canonicalise
 * to that shape here so the slug matches the real CDN path and the
 * locally bundled filename in `public/noto/`.
 *
 * Mid-sequence `fe0f` inside a longer ZWJ sequence (e.g. emoji-modifier
 * sequences) is left intact because Noto keeps it there.
 */
export function unicodeToCodepoint(emoji: string): string {
  const parts = [...emoji].map((ch) => ch.codePointAt(0)!.toString(16))
  // Drop trailing fe0f only when the sequence is exactly "base + fe0f".
  // Anything longer (ZWJ sequences, modifier sequences) keeps fe0f intact.
  if (parts.length === 2 && parts[1] === 'fe0f') {
    return parts[0]
  }
  return parts.join('-')
}

/**
 * URL of the Lottie JSON for an emoji on Google's CDN.
 *
 * The caller is responsible for handling 404s (use `NO_LOTTIE` to skip
 * known-static emojis before requesting).
 */
export function notoLottieUrl(emoji: string): string {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${unicodeToCodepoint(emoji)}/lottie.json`
}

/**
 * URL of the static SVG for an emoji on Google's CDN.
 *
 * Coverage is effectively complete for the Unicode emoji subset Noto ships.
 */
export function notoSvgUrl(emoji: string): string {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${unicodeToCodepoint(emoji)}/emoji.svg`
}

/**
 * Emojis from `src/assets/emojis.ts` that DO NOT have a `lottie.json` on
 * Google's CDN. Sourced from a live audit (`scripts/audit-noto.mjs`).
 *
 * `<NotoEmoji animated>` short-circuits to the static SVG for these so we
 * avoid a guaranteed-404 round-trip on every mount.
 */
export const NO_LOTTIE: ReadonlySet<string> = new Set([
  '👺', // 1f47a
  '🐶', // 1f436
  '🐯', // 1f42f
  '🐷', // 1f437
  '🐵', // 1f435
  '🐔', // 1f414
  '🦆', // 1f986
  '🐗', // 1f417
  '🐴', // 1f434
  '🪲', // 1fab2
  '🦑', // 1f991
  '🦐', // 1f990
  '🐠', // 1f420
  '🐋', // 1f40b
  '🐆', // 1f406
  '🦓', // 1f993
  '🐘', // 1f418
  '🦛', // 1f99b
  '🦏', // 1f98f
  '🐪', // 1f42a
  '🐫', // 1f42b
  '🦙', // 1f999
  '🦒', // 1f992
  '🐃', // 1f403
  '🐄', // 1f404
  '🐏', // 1f40f
  '🐑', // 1f411
  '🦌', // 1f98c
  '🐈', // 1f408
  '🐁', // 1f401
  '🐨', // 1f428
  '🦨', // 1f9a8
  '🍟', // 1f35f
  '🥙', // 1f959
  '🍣', // 1f363
  '🍱', // 1f371
  '🥟', // 1f95f
  '🍙', // 1f359
  '🍘', // 1f358
  '🍤', // 1f364
  '🍰', // 1f370
  '🧁', // 1f9c1
  '🍧', // 1f367
  '🍫', // 1f36b
  '🍬', // 1f36c
  '🍭', // 1f36d
  '🍌', // 1f34c
  '🍑', // 1f351
  '🥥', // 1f965
  '🍆', // 1f346
  '🍺', // 1f37a
  '🥃', // 1f943
  '🍸', // 1f378
  '🍶', // 1f376
  '🏈', // 1f3c8
  '🏐', // 1f3d0
  '🪀', // 1fa80
  '🎮', // 1f3ae
  '🕹️', // 1f579-fe0f
  '🃏', // 1f0cf
  '🎤', // 1f3a4
  '🎧', // 1f3a7
  '🎹', // 1f3b9
  '🪘', // 1fa98
  '🎨', // 1f3a8
  '🖌️', // 1f58c-fe0f
  '🌕', // 1f315
  '🌖', // 1f316
  '🌗', // 1f317
  '🌘', // 1f318
  '🌑', // 1f311
  '☀️', // 2600-fe0f
  '🌤️', // 1f324-fe0f
  '🌧️', // 1f327-fe0f
])

/**
 * Manifest of emojis bundled into `public/noto/` by `scripts/fetch-noto.mjs`.
 * Used by `<NotoEmoji>` to prefer local assets over the CDN for the "top N"
 * most-likely-picked avatars. The generated file is a TS module that always
 * exists (the script writes an empty stub if no assets were fetched), so
 * import is safe at module load.
 */
import { LOCAL_LOTTIE_CODEPOINTS, LOCAL_SVG_CODEPOINTS } from './notoManifest'

const LOCAL_LOTTIE = new Set<string>(LOCAL_LOTTIE_CODEPOINTS)
const LOCAL_SVG = new Set<string>(LOCAL_SVG_CODEPOINTS)

/**
 * Resolve the URL for an emoji's Lottie. Prefers a locally bundled asset
 * (cached at install time, available offline) over the CDN.
 *
 * Always returns a URL even if the emoji is in NO_LOTTIE — callers should
 * check NO_LOTTIE first to avoid a guaranteed-404 fetch.
 */
export function resolveLottieUrl(emoji: string, base = ''): string {
  const cp = unicodeToCodepoint(emoji)
  if (LOCAL_LOTTIE.has(cp)) return `${base}/noto/lottie/${cp}.json`
  return notoLottieUrl(emoji)
}

/**
 * Resolve the URL for an emoji's static SVG. Prefers a locally bundled
 * asset over the CDN.
 */
export function resolveSvgUrl(emoji: string, base = ''): string {
  const cp = unicodeToCodepoint(emoji)
  if (LOCAL_SVG.has(cp)) return `${base}/noto/svg/${cp}.svg`
  return notoSvgUrl(emoji)
}
