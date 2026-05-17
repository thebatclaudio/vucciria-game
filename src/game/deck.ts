import { CARDS } from './cards'

/**
 * Deterministic shuffle (Fisher–Yates with a seeded RNG) so all peers
 * agree on the same order from the same seed.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffledDeck(seed: number): string[] {
  const rand = mulberry32(seed)
  const ids = CARDS.map((c) => c.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

/**
 * Given the current deck and an index, returns the next card id and the
 * updated (possibly reshuffled) deck + index. When we run off the end,
 * we reshuffle with a derived seed.
 */
export function drawNext(
  deck: string[],
  index: number,
  reshuffleSeed: number,
): { cardId: string; nextDeck: string[]; nextIndex: number } {
  if (index >= deck.length) {
    const nextDeck = shuffledDeck(reshuffleSeed)
    return { cardId: nextDeck[0], nextDeck, nextIndex: 1 }
  }
  return { cardId: deck[index], nextDeck: deck, nextIndex: index + 1 }
}
