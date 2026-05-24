import { describe, it, expect } from 'vitest'
import { buildEffectSummary } from '@/game/effectSummary'
import type { Player } from '@/game/types'

const mk = (id: string, seat: number, lives = 3, nickname = id): Player => ({
  peerId: id,
  nickname,
  emoji: '🧑',
  lives,
  seat,
  joinedAt: seat * 1000,
})

// Minimal i18n stub: returns a string that embeds the key + interpolations
// so assertions can verify the right branch was taken without depending on
// real translations.
type TFn = (key: string, params?: Record<string, unknown>) => string
const fakeTImpl: TFn = (key, params) => {
  if (!params) return key
  const parts = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .join(',')
  return `${key}(${parts})`
}
// `buildEffectSummary` accepts an i18next TFunction; our stub is structurally
// compatible for these tests. Cast through unknown to satisfy the strict type.
const fakeT = fakeTImpl as unknown as Parameters<typeof buildEffectSummary>[0]['t']

describe('buildEffectSummary', () => {
  const alice = mk('a', 0, 3, 'Alice')
  const bob = mk('b', 1, 3, 'Bob')
  const carol = mk('c', 2, 3, 'Carol')
  const players = [alice, bob, carol]

  it('auto self (bevi) — drawer drank', () => {
    const s = buildEffectSummary({
      cardId: 'bevi',
      drawerId: alice.peerId,
      players,
      chosenIds: [],
      t: fakeT,
    })
    expect(s).toContain('play.summary.drinkOne')
    expect(s).toContain('name=Alice')
  })

  it('auto all (bevonoTutti) — everyone drinks', () => {
    const s = buildEffectSummary({
      cardId: 'bevonoTutti',
      drawerId: alice.peerId,
      players,
      chosenIds: [],
      t: fakeT,
    })
    expect(s).toContain('play.summary.allDrink')
  })

  it('auto neighbors (treAveMaria) — multiple drink', () => {
    const s = buildEffectSummary({
      cardId: 'treAveMaria',
      drawerId: bob.peerId,
      players,
      chosenIds: [],
      t: fakeT,
    })
    expect(s).toContain('play.summary.multipleDrink')
    expect(s).toContain('Alice')
    expect(s).toContain('Bob')
    expect(s).toContain('Carol')
  })

  it('auto delta=0 (pipi) — free pass', () => {
    const s = buildEffectSummary({
      cardId: 'pipi',
      drawerId: alice.peerId,
      players,
      chosenIds: [],
      t: fakeT,
    })
    expect(s).toContain('play.summary.freePass')
    expect(s).toContain('name=Alice')
  })

  it('auto jolly — jolly granted', () => {
    const s = buildEffectSummary({
      cardId: 'jolly',
      drawerId: alice.peerId,
      players,
      chosenIds: [],
      t: fakeT,
    })
    expect(s).toContain('play.summary.jollyGranted')
    expect(s).toContain('name=Alice')
  })

  it('drawer-choice beviOoffri — single target drinks', () => {
    const s = buildEffectSummary({
      cardId: 'beviOoffri',
      drawerId: alice.peerId,
      players,
      chosenIds: [bob.peerId],
      t: fakeT,
    })
    expect(s).toContain('play.summary.drinkOne')
    expect(s).toContain('name=Bob')
  })

  it('drawer-choice tuEcumpari — both drink', () => {
    const s = buildEffectSummary({
      cardId: 'tuEcumpari',
      drawerId: alice.peerId,
      players,
      chosenIds: [bob.peerId],
      t: fakeT,
    })
    expect(s).toContain('play.summary.drinkBoth')
    expect(s).toContain('a=Alice')
    expect(s).toContain('b=Bob')
  })

  it('drawer-choice tuEcumpari self-pick — double drink', () => {
    const s = buildEffectSummary({
      cardId: 'tuEcumpari',
      drawerId: alice.peerId,
      players,
      chosenIds: [alice.peerId],
      t: fakeT,
    })
    expect(s).toContain('play.summary.selfDoubleDrink')
    expect(s).toContain('name=Alice')
  })

  it('host-choice with empty selection (zingBoing, none lost) — no one', () => {
    const s = buildEffectSummary({
      cardId: 'zingBoing',
      drawerId: alice.peerId,
      players,
      chosenIds: [],
      t: fakeT,
    })
    expect(s).toContain('play.summary.noOne')
  })

  it('host-choice with multiple losers — multipleDrink', () => {
    const s = buildEffectSummary({
      cardId: 'zingBoing',
      drawerId: alice.peerId,
      players,
      chosenIds: [bob.peerId, carol.peerId],
      t: fakeT,
    })
    expect(s).toContain('play.summary.multipleDrink')
    expect(s).toContain('Bob')
    expect(s).toContain('Carol')
  })

  it('duel — only the loser drinks', () => {
    const s = buildEffectSummary({
      cardId: 'sfida',
      drawerId: alice.peerId,
      players,
      chosenIds: [bob.peerId],
      t: fakeT,
    })
    expect(s).toContain('play.summary.drinkOne')
    expect(s).toContain('name=Bob')
  })

  it('manual (mossa) — manualMove banner', () => {
    const s = buildEffectSummary({
      cardId: 'mossa',
      drawerId: alice.peerId,
      players,
      chosenIds: [],
      t: fakeT,
    })
    expect(s).toContain('play.summary.manualMove')
  })
})
