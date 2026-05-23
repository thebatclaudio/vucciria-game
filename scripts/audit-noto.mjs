#!/usr/bin/env node
/**
 * One-shot audit: probe Noto for every avatar emoji in src/assets/emojis.ts
 * and report which lack a `lottie.json`. Used to seed the NO_LOTTIE set in
 * src/assets/notoEmojiMap.ts.
 *
 * Run: `node scripts/audit-noto.mjs`
 *
 * Idempotent and read-only. Safe to re-run when new emoji are added.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest'

/** unicode emoji → Noto codepoint slug ("1f98a", "0037-fe0f-20e3"). */
function unicodeToCodepoint(emoji) {
  return [...emoji]
    .map((ch) => ch.codePointAt(0).toString(16))
    .join('-')
}

async function main() {
  const src = await readFile(path.join(root, 'src/assets/emojis.ts'), 'utf8')
  // Pull every quoted glyph from the EMOJIS array literal.
  const matches = [...src.matchAll(/'([^']+)'/g)].map((m) => m[1])
  // Filter to real emoji-looking strings (skip the helper names).
  const emojis = [...new Set(matches.filter((s) => /\p{Extended_Pictographic}/u.test(s)))]

  console.log(`Auditing ${emojis.length} unique emoji against Noto...\n`)

  const results = await Promise.all(
    emojis.map(async (e) => {
      const cp = unicodeToCodepoint(e)
      const url = `${NOTO_BASE}/${cp}/lottie.json`
      const r = await fetch(url, { method: 'HEAD' })
      return { e, cp, ok: r.ok, status: r.status }
    }),
  )

  const missing = results.filter((r) => !r.ok)
  const present = results.filter((r) => r.ok)

  console.log(`✓ Animated (${present.length}):`)
  console.log(present.map((r) => `${r.e} ${r.cp}`).join('  '))
  console.log(`\n✗ No Lottie — needs static fallback (${missing.length}):`)
  for (const r of missing) {
    console.log(`  ${r.e}  ${r.cp}  (HTTP ${r.status})`)
  }

  console.log('\n// Copy into src/assets/notoEmojiMap.ts:')
  console.log('export const NO_LOTTIE: ReadonlySet<string> = new Set([')
  for (const r of missing) {
    console.log(`  '${r.e}', // ${r.cp}`)
  }
  console.log('])')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
