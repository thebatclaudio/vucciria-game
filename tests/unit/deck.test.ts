import { describe, it, expect } from 'vitest'
import { CARDS } from '@/game/cards'
import { drawNext, shuffledDeck } from '@/game/deck'

describe('deck', () => {
  it('shuffledDeck returns all 13 cards exactly once', () => {
    const deck = shuffledDeck(42)
    expect(deck).toHaveLength(CARDS.length)
    expect(new Set(deck).size).toBe(CARDS.length)
  })

  it('shuffledDeck is deterministic for a given seed', () => {
    expect(shuffledDeck(123)).toEqual(shuffledDeck(123))
  })

  it('different seeds produce different orders (statistically)', () => {
    const a = shuffledDeck(1).join(',')
    const b = shuffledDeck(2).join(',')
    expect(a).not.toBe(b)
  })

  it('drawNext returns next card and advances index', () => {
    const deck = shuffledDeck(7)
    const r = drawNext(deck, 0, 999)
    expect(r.cardId).toBe(deck[0])
    expect(r.nextIndex).toBe(1)
    expect(r.nextDeck).toBe(deck)
  })

  it('drawNext reshuffles when running off the end', () => {
    const deck = shuffledDeck(7)
    const r = drawNext(deck, deck.length, 12345)
    expect(r.nextIndex).toBe(1)
    expect(r.nextDeck).not.toBe(deck)
    expect(r.nextDeck).toHaveLength(CARDS.length)
  })
})
