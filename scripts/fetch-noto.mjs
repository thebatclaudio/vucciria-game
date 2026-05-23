#!/usr/bin/env node
/**
 * Download Noto animated emoji assets from Google's CDN into `public/noto/`
 * so they're bundled with the PWA and available offline.
 *
 * Strategy is asymmetric by asset type:
 *   - `emoji.svg`    → fetched for EVERY emoji in the catalog. Static SVGs
 *                      are small (~3-8 KB) and the runtime fallback chain
 *                      depends on the static SVG always being available
 *                      offline. Bundling all of them is the only way to
 *                      guarantee the installed PWA never shows a "white
 *                      box" avatar when the CDN is unreachable (airplane
 *                      mode, captive portal, blocked third-party origin,
 *                      first launch before the runtime cache has warmed).
 *   - `lottie.json`  → fetched only for the top N most-likely-picked
 *                      avatars (TOP_N_LOTTIE). Lotties are large (often
 *                      100-300 KB each), so we accept that animated
 *                      rendering for the long tail requires connectivity;
 *                      <NotoEmoji> falls back gracefully to the (now
 *                      always-local) static SVG when a Lottie isn't
 *                      available.
 *
 * Then rewrites `src/assets/notoManifest.ts` listing what's locally
 * available, so the runtime `<NotoEmoji>` can pick local URLs over CDN.
 *
 * Run: `pnpm prefetch:noto`
 * Idempotent: skips files that already exist.
 */
import { mkdir, writeFile, stat, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest'
const PUBLIC_DIR = path.join(root, 'public', 'noto')
const LOTTIE_DIR = path.join(PUBLIC_DIR, 'lottie')
const SVG_DIR = path.join(PUBLIC_DIR, 'svg')
const MANIFEST_TS = path.join(root, 'src', 'assets', 'notoManifest.ts')

/**
 * Cap for animated Lottie bundling. Static SVGs are always bundled for
 * every emoji in the catalog regardless of this value.
 */
const TOP_N_LOTTIE = 20

/**
 * Mirror of `src/assets/notoEmojiMap.ts::unicodeToCodepoint`. Keep in
 * sync — both produce the canonical Noto slug, including stripping a
 * trailing `-fe0f` for plain "base + variation selector" emojis (which
 * Noto's CDN serves under the bare base codepoint).
 */
function unicodeToCodepoint(emoji) {
  const parts = [...emoji].map((ch) => ch.codePointAt(0).toString(16))
  if (parts.length === 2 && parts[1] === 'fe0f') return parts[0]
  return parts.join('-')
}

/** Read the NO_LOTTIE set + EMOJIS list from source so we stay in sync. */
async function loadEmojis() {
  const emojisSrc = await readFile(
    path.join(root, 'src/assets/emojis.ts'),
    'utf8',
  )
  // Find the EMOJIS array literal.
  const arrayMatch = emojisSrc.match(
    /export const EMOJIS:[^=]*=\s*\[([\s\S]*?)\]/,
  )
  if (!arrayMatch) throw new Error('Could not parse EMOJIS array')
  const all = [...arrayMatch[1].matchAll(/'([^']+)'/g)]
    .map((m) => m[1])
    .filter((s) => /\p{Extended_Pictographic}/u.test(s))
  // Deduplicate, preserving order.
  const seen = new Set()
  const ordered = []
  for (const e of all) {
    if (!seen.has(e)) {
      seen.add(e)
      ordered.push(e)
    }
  }

  const mapSrc = await readFile(
    path.join(root, 'src/assets/notoEmojiMap.ts'),
    'utf8',
  )
  const noLottieMatch = mapSrc.match(
    /NO_LOTTIE[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/,
  )
  const noLottie = new Set(
    noLottieMatch
      ? [...noLottieMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      : [],
  )
  return { ordered, noLottie }
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function downloadOne(url, dest) {
  if (await exists(dest)) return 'skip'
  const r = await fetch(url)
  if (!r.ok) return `http-${r.status}`
  const buf = Buffer.from(await r.arrayBuffer())
  await writeFile(dest, buf)
  return 'ok'
}

async function main() {
  await mkdir(LOTTIE_DIR, { recursive: true })
  await mkdir(SVG_DIR, { recursive: true })

  const { ordered, noLottie } = await loadEmojis()
  console.log(
    `Prefetching Noto assets → public/noto/ ` +
      `(${ordered.length} SVGs, first ${TOP_N_LOTTIE} also Lottie) …\n`,
  )

  const localLottie = []
  const localSvg = []

  for (let i = 0; i < ordered.length; i++) {
    const e = ordered[i]
    const cp = unicodeToCodepoint(e)
    // Static SVG: always fetched for every emoji so the offline fallback
    // chain in <NotoEmoji> can always resolve to a local asset.
    const svgResult = await downloadOne(
      `${NOTO_BASE}/${cp}/emoji.svg`,
      path.join(SVG_DIR, `${cp}.svg`),
    )
    if (svgResult === 'ok' || svgResult === 'skip') localSvg.push(cp)
    // Lottie only for the top N likely-picked avatars, and only if Noto
    // is known to ship one for this emoji.
    let lottieResult = i < TOP_N_LOTTIE && !noLottie.has(e) ? null : 'skip-tier'
    if (lottieResult === null) {
      lottieResult = await downloadOne(
        `${NOTO_BASE}/${cp}/lottie.json`,
        path.join(LOTTIE_DIR, `${cp}.json`),
      )
      if (lottieResult === 'ok' || lottieResult === 'skip') localLottie.push(cp)
    }
    console.log(
      `  ${e} ${cp.padEnd(20)} svg:${svgResult.padEnd(8)} lottie:${lottieResult}`,
    )
  }

  // Write the manifest module.
  const banner = `/**
 * Auto-generated by \`scripts/fetch-noto.mjs\`. Do not edit by hand.
 *
 * Lists the Noto emoji codepoints (e.g. "1f98a") for which we have a local
 * copy of the asset under \`public/noto/{lottie|svg}/{cp}.{json|svg}\`.
 *
 * <NotoEmoji> uses these sets to decide whether to load from local (fast,
 * offline-safe) or from the CDN (long tail).
 */
`
  const body =
    `export const LOCAL_LOTTIE_CODEPOINTS: readonly string[] = [\n` +
    localLottie.map((cp) => `  '${cp}',`).join('\n') +
    `\n]\n\n` +
    `export const LOCAL_SVG_CODEPOINTS: readonly string[] = [\n` +
    localSvg.map((cp) => `  '${cp}',`).join('\n') +
    `\n]\n`
  await writeFile(MANIFEST_TS, banner + body)
  console.log(
    `\n✓ Wrote ${MANIFEST_TS} (${localLottie.length} lottie, ${localSvg.length} svg)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
