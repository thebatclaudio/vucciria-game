/**
 * 6-character game code generator.
 *
 * Alphabet excludes confusable characters (0/O, 1/I/L) to reduce typos.
 * Space: 30^6 = 729,000,000 codes — more than enough for "no global registry".
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 31 chars, then we cut O/L if leaking

const CLEAN = ALPHABET.replace(/[OL]/g, '') // ensure clean

export const CODE_LENGTH = 6

export function generateGameCode(): string {
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CLEAN[bytes[i] % CLEAN.length]
  }
  return out
}

export function isValidGameCode(code: string): boolean {
  if (typeof code !== 'string') return false
  if (code.length !== CODE_LENGTH) return false
  return [...code].every((ch) => CLEAN.includes(ch))
}

export function normalizeGameCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)
}
