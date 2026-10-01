// Drop-Logik: gewichtete Seltenheits-Auswahl + Streak-Bonus.
// `simulateDrops` erlaubt Balance-Prüfungen mit vielen Drops (Testfunktion
// im Sammlungs-Tab). Rein deterministische Mathematik, kein Zustand.

import { platesOfRarity, RARITY_ORDER, RARITY_WEIGHTS, type Plate, type Rarity } from './plates'

/**
 * Streak-Luck: ab 3 Tagen in Folge verschiebt sich die Verteilung sanft
 * Richtung seltener Stufen. Multiplikator wächst logarithmisch, ist bei
 * Streak 10 ca. 2.0 und deckelt bei 3 (Streak ~31 Tage). Common sinkt
 * entsprechend — die Summe aller Gewichte bleibt 100 (renormalisiert).
 */
export function streakLuckMultiplier(streak: number): number {
  if (streak < 3) return 1
  return Math.min(1 + Math.log2(streak - 1) * 0.33, 3)
}

/** Effektive Drop-Gewichte inkl. Streak-Bonus (Summe = 100). */
export function effectiveWeights(streak: number): Record<Rarity, number> {
  const luck = streakLuckMultiplier(streak)
  const raw = RARITY_ORDER.map((rarity) => {
    const base = RARITY_WEIGHTS[rarity]
    // Common bleibt unangetastet; alles Rare+ wird hochskaliert.
    return rarity === 'common' ? base : base * luck
  })
  const sum = raw.reduce((a, b) => a + b, 0)
  return RARITY_ORDER.reduce((acc, rarity, i) => {
    acc[rarity] = (raw[i] / sum) * 100
    return acc
  }, {} as Record<Rarity, number>)
}

export interface DropResult {
  plate: Plate
  rarity: Rarity
  /** Wahrer Streak-Multiplikator zum Drop-Zeitpunkt (fürs Overlay). */
  luck: number
}

/** Würfelt einen Platten-Drop (uniform zufällig, gewichtet nach Seltenheit). */
export function rollDrop(streak: number, rng: () => number = Math.random): DropResult {
  const weights = effectiveWeights(streak)
  const roll = rng() * 100
  let rarity: Rarity = 'common'
  let cumulative = 0
  for (const r of RARITY_ORDER) {
    cumulative += weights[r]
    if (roll < cumulative) {
      rarity = r
      break
    }
  }
  const pool = platesOfRarity(rarity)
  const plate = pool[Math.floor(rng() * pool.length)] ?? pool[0]
  return { plate, rarity, luck: streakLuckMultiplier(streak) }
}

export interface SimulationReport {
  drops: number
  /** relative Häufigkeit je Stufe in % */
  byRarity: Record<Rarity, { count: number; percent: number }>
  /** seltenstes Ergebnis */
  bestRarity: Rarity | null
  /** Durchschnitt an Drops bis zum ersten Legendary (bei Streak 0) */
  expectedDropsPerLegendary: number
}

/**
 * Balance-Test: simuliert `count` Drops und liefert die Verteilung.
 * Wird im Sammlungs-Tab als „Balance-Check“ angezeigt.
 */
export function simulateDrops(count: number, streak = 0, rng: () => number = Math.random): SimulationReport {
  const counts = RARITY_ORDER.reduce((acc, r) => {
    acc[r] = 0
    return acc
  }, {} as Record<Rarity, number>)
  for (let i = 0; i < count; i++) {
    counts[rollDrop(streak, rng).rarity]++
  }
  const byRarity = RARITY_ORDER.reduce((acc, r) => {
    acc[r] = { count: counts[r], percent: (counts[r] / count) * 100 }
    return acc
  }, {} as SimulationReport['byRarity'])
  const best = [...RARITY_ORDER].reverse().find((r) => counts[r] > 0) ?? null
  return {
    drops: count,
    byRarity,
    bestRarity: best,
    expectedDropsPerLegendary: Math.round(100 / effectiveWeights(streak).legendary),
  }
}
