import { describe, it, expect } from 'vitest'
import {
  unicodeToCodepoint,
  notoLottieUrl,
  notoSvgUrl,
  NO_LOTTIE,
} from '@/assets/notoEmojiMap'
import { EMOJIS } from '@/assets/emojis'

describe('unicodeToCodepoint', () => {
  it('encodes a single astral codepoint as one hex segment', () => {
    expect(unicodeToCodepoint('🦊')).toBe('1f98a')
    expect(unicodeToCodepoint('🐱')).toBe('1f431')
    expect(unicodeToCodepoint('🤖')).toBe('1f916')
  })

  it('preserves variation selectors (FE0F) joined with -', () => {
    expect(unicodeToCodepoint('☀️')).toBe('2600-fe0f')
    expect(unicodeToCodepoint('⚔️')).toBe('2694-fe0f')
  })

  it('encodes keycap sequences (digit + FE0F + 20E3)', () => {
    expect(unicodeToCodepoint('7️⃣')).toBe('37-fe0f-20e3')
    expect(unicodeToCodepoint('2️⃣')).toBe('32-fe0f-20e3')
  })

  it('encodes ZWJ sequences', () => {
    // 👨‍👩‍👧 = man (1f468) + ZWJ (200d) + woman (1f469) + ZWJ + girl (1f467)
    expect(unicodeToCodepoint('👨‍👩‍👧')).toBe(
      '1f468-200d-1f469-200d-1f467',
    )
  })
})

describe('notoLottieUrl / notoSvgUrl', () => {
  it('builds the canonical CDN URLs', () => {
    expect(notoLottieUrl('🦊')).toBe(
      'https://fonts.gstatic.com/s/e/notoemoji/latest/1f98a/lottie.json',
    )
    expect(notoSvgUrl('🦊')).toBe(
      'https://fonts.gstatic.com/s/e/notoemoji/latest/1f98a/emoji.svg',
    )
  })
})

describe('NO_LOTTIE catalogue', () => {
  it('every entry is a string present in our avatar set', () => {
    // Every NO_LOTTIE entry must actually be one of our avatars; otherwise it
    // is a dead entry and should be removed (or the audit re-run).
    const all = new Set(EMOJIS)
    for (const e of NO_LOTTIE) {
      expect(all.has(e), `${e} listed in NO_LOTTIE but not in EMOJIS`).toBe(
        true,
      )
    }
  })
})
