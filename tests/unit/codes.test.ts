import { describe, it, expect } from 'vitest'
import { generateGameCode, isValidGameCode, normalizeGameCode, CODE_LENGTH } from '@/game/codes'

describe('codes', () => {
  it('generateGameCode produces the right length', () => {
    expect(generateGameCode()).toHaveLength(CODE_LENGTH)
  })

  it('generated codes are valid', () => {
    for (let i = 0; i < 100; i++) {
      expect(isValidGameCode(generateGameCode())).toBe(true)
    }
  })

  it('generated codes never contain confusable chars', () => {
    for (let i = 0; i < 100; i++) {
      const c = generateGameCode()
      expect(c).not.toMatch(/[OL01I]/)
    }
  })

  it('normalizeGameCode uppercases, strips, and trims', () => {
    expect(normalizeGameCode('ab-c12!3xx')).toBe('ABC123')
    expect(normalizeGameCode('  abcdef  ')).toBe('ABCDEF')
  })

  it('isValidGameCode rejects bad input', () => {
    expect(isValidGameCode('')).toBe(false)
    expect(isValidGameCode('ABCDE')).toBe(false)
    expect(isValidGameCode('ABCDEFG')).toBe(false)
    expect(isValidGameCode('ABCDE0')).toBe(false) // contains 0
  })
})
