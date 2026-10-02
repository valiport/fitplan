// Drop-Logik: Streak-Luck, effektive Gewichte, Würfel- und Simulations-Vertrag.

import { describe, expect, it } from 'vitest'
import {
  effectiveWeights,
  rollDrop,
  simulateDrops,
  streakLuckMultiplier,
} from './drops'
import { PLATES, RARITY_ORDER, RARITY_WEIGHTS, platesOfRarity } from './plates'

/** Deterministischer LCG — Tests dürfen nie von Math.random abhängen. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x1_0000_0000
  }
}

describe('streakLuckMultiplier', () => {
  it('ist ohne Bonus unter 3 Tagen', () => {
    expect(streakLuckMultiplier(0)).toBe(1)
    expect(streakLuckMultiplier(1)).toBe(1)
    expect(streakLuckMultiplier(2)).toBe(1)
  })

  it('wächst logarithmisch und ist bei Streak 10 ca. 2.0', () => {
    const at10 = streakLuckMultiplier(10)
    expect(at10).toBeGreaterThan(1.9)
    expect(at10).toBeLessThan(2.1)
    expect(streakLuckMultiplier(20)).toBeGreaterThan(at10)
  })

  it('deckelt bei 3 (kein unbegrenzter Vorteil)', () => {
    expect(streakLuckMultiplier(50)).toBeLessThanOrEqual(3)
    expect(streakLuckMultiplier(10_000)).toBe(3)
  })
})

describe('effectiveWeights', () => {
  it('summiert sich immer auf 100', () => {
    for (const streak of [0, 1, 3, 7, 10, 30, 500]) {
      const weights = effectiveWeights(streak)
      const sum = RARITY_ORDER.reduce((acc, r) => acc + weights[r], 0)
      expect(sum).toBeCloseTo(100, 6)
    }
  })

  it('ohne Streak exakt den Basisgewichten', () => {
    const weights = effectiveWeights(0)
    for (const rarity of RARITY_ORDER) {
      expect(weights[rarity]).toBeCloseTo(RARITY_WEIGHTS[rarity], 6)
    }
  })

  it('Streak hebt Rare+ an und drückt Common relativ', () => {
    const base = effectiveWeights(0)
    const lucky = effectiveWeights(30)
    expect(lucky.legendary).toBeGreaterThan(base.legendary)
    expect(lucky.epic).toBeGreaterThan(base.epic)
    expect(lucky.common).toBeLessThan(base.common)
  })
})

describe('rollDrop', () => {
  it('gibt nur Platten aus dem Katalog der gewürfelten Stufe zurück', () => {
    const rng = lcg(42)
    for (let i = 0; i < 500; i++) {
      const { plate, rarity } = rollDrop(i % 40, rng)
      expect(PLATES).toContainEqual(plate)
      expect(plate.rarity).toBe(rarity)
      expect(platesOfRarity(rarity)).toContainEqual(plate)
    }
  })

  it('respektiert bei Streak 0 die Basiswahrscheinlichkeiten (Toleranz)', () => {
    const rng = lcg(7)
    const count = 10_000
    const counts: Record<string, number> = {}
    for (let i = 0; i < count; i++) {
      const { rarity } = rollDrop(0, rng)
      counts[rarity] = (counts[rarity] ?? 0) + 1
    }
    // Common 60 % ± 3, legendary 1 % (untere Grenze 0)
    expect(counts['common'] / count).toBeGreaterThan(0.56)
    expect(counts['common'] / count).toBeLessThan(0.64)
    expect(counts['legendary']).toBeGreaterThanOrEqual(0)
    const total = RARITY_ORDER.reduce((acc, r) => acc + (counts[r] ?? 0), 0)
    expect(total).toBe(count)
  })
})

describe('simulateDrops', () => {
  it('Prozente summieren sich auf 100 und Counts auf die Anzahl', () => {
    const report = simulateDrops(1000, 5, lcg(99))
    const counts = RARITY_ORDER.reduce((acc, r) => acc + report.byRarity[r].count, 0)
    const percent = RARITY_ORDER.reduce((acc, r) => acc + report.byRarity[r].percent, 0)
    expect(counts).toBe(1000)
    expect(percent).toBeCloseTo(100, 4)
    expect(report.expectedDropsPerLegendary).toBeGreaterThan(0)
  })

  it('ist mit gleichem Seed deterministisch', () => {
    const a = simulateDrops(500, 10, lcg(1))
    const b = simulateDrops(500, 10, lcg(1))
    expect(a.byRarity).toEqual(b.byRarity)
  })
})
