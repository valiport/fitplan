// Ernährungs-Mathematik: Grundumsatz, Tagesumsatz, Zielanpassung,
// Makro-Verteilung je Tagesart. Alles Schätzungen (Mifflin-St Jeor),
// kein Ersatz für Ernährungsberatung.

import type { Diet, Goal, DayKind, Profile } from './types'

/** Grundumsatz (BMR) nach Mifflin-St Jeor. */
export function basalMetabolism(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return Math.round(p.sex === 'male' ? base + 5 : base - 161)
}

/** Aktivitätsfaktor je Tagesart, mit leichtem Sportart-Bias (Ausdauer höher). */
export function activityFactor(sport: Profile['sport'], kind: DayKind): number {
  const base: Record<DayKind, number> = { hard: 1.55, easy: 1.375, rest: 1.2 }
  const bias =
    sport === 'running' || sport === 'cycling' ? 0.05 : sport === 'combat' ? 0.03 : 0
  return base[kind] + bias
}

/** Ziel-Anpassung: Abnehmen −20 %, Aufbauen +10 %, Halten ±0. */
export function goalFactor(goal: Goal): number {
  return goal === 'lose' ? 0.8 : goal === 'gain' ? 1.1 : 1
}

/** Ziel-Kalorien für einen bestimmten Tag. */
export function dayKcal(p: Profile, kind: DayKind): number {
  return Math.round(
    basalMetabolism(p) * activityFactor(p.sport, kind) * goalFactor(p.goal),
  )
}

/**
 * Verteilt die Tageskalorien auf 4 Mahlzeiten (Frühstück/Lunch/Snack/Abend),
 * mit kohlenhydratlastigerer Verteilung an harten Tagen.
 */
export function mealSplit(kind: DayKind): [number, number, number, number] {
  //              Frühstück  Lunch  Snack  Abend
  if (kind === 'hard') return [0.27, 0.3, 0.13, 0.3]
  if (kind === 'easy') return [0.25, 0.3, 0.15, 0.3]
  return [0.25, 0.3, 0.15, 0.3]
}

/** Ernährungsform verändert nur die Rezept-Auswahl, nicht die Mathematik. */
export function dietLabel(diet: Diet): string {
  return diet === 'vegan'
    ? 'Vegan'
    : diet === 'vegetarian'
      ? 'Vegetarisch'
      : 'Omnivor'
}
