// Wochenstruktur & Übungs-Bibliothek.
// Pro Sportart: Pools für harte Tage, leichte Tage und Ruhetage sowie
// Ergänzungsübungen. Der Wochenplan wählt per Seed rotierend aus, damit
// der Pro-Reroll auch die Einheiten variiert.

import type { DayKind, Sport } from './types'

/**
 * Verteilt `trainingDays` (1–6) Trainingstage auf die Woche (Mo..So).
 * Schema: hart/leicht im Wechsel, Ruhetage dazwischen; Rest-Tage hinten Ruhe.
 */
export function buildWeekKinds(trainingDays: number): DayKind[] {
  const days: DayKind[] = ['rest', 'rest', 'rest', 'rest', 'rest', 'rest', 'rest']
  const slots = [0, 2, 4, 1, 3, 5] // Reihenfolge der belegten Tage
  for (let i = 0; i < Math.min(Math.max(trainingDays, 0), 6); i++) {
    days[slots[i]] = i % 2 === 0 ? 'hard' : 'easy'
  }
  return days
}

interface WorkoutLibrary {
  hard: string[]
  easy: string[]
  rest: string[]
  supplements: string[]
}

export const WORKOUT_LIBRARY: Record<Sport, WorkoutLibrary> = {
  running: {
    hard: [
      'Intervalle 6 × 800 m (Tempo, VO₂max, Laufökonomie)',
      'Tempodauerlauf (Laktatschwelle, zügige Ausdauer)',
      'Intervalle 8 × 400 m (Schnelligkeit, VO₂max)',
    ],
    easy: [
      'Langer Lauf (Grundlagenausdauer, Fettstoffwechsel, mentale Ausdauer)',
      'Ruhiger Dauerlauf 40–50 min + Steigerungsläufe (Laufrhythmus)',
      'Lauf-ABC: Kniehebelauf, Anfersen, Skippings (Technik, Koordination)',
    ],
    rest: [
      'Ruhetag: Spaziergang, Mobility',
      'Ruhetag: Dehnen, Fußgelenk-Stabilität',
    ],
    supplements: [
      'Ausfallschritte & Wadenheben (Beinkraft, Prävention)',
      'Planks (Rumpfstabilität, ökonomische Haltung)',
    ],
  },
  cycling: {
    hard: [
      'Intervalle 4 × 8 min (Schwellenleistung, Erholungsfähigkeit)',
      'Schwellentraining 2 × 20 min (Dauerleistung, Kraftausdauer)',
      'Bergfahrt / Kraftausdauer, niedrige Trittfrequenz (Beinkraft)',
    ],
    easy: [
      'Grundlagenausfahrt 60–75 min, locker (Ausdauer, Fettstoffwechsel)',
      'Lange Ausfahrt (Ausdauer, Trinken & Ernährung unterwegs üben)',
    ],
    rest: [
      'Ruhetag: Dehnen, Fahrrad-Check',
      'Ruhetag: Spaziergang, Mobility',
    ],
    supplements: [
      'Kniebeugen & Kreuzheben (Kraft pro Tritt)',
      'Planks & Rückenstrecker (Rumpf, Haltung auf langen Ausfahrten)',
    ],
  },
  strength: {
    hard: [
      'Schwerpunkt Unterkörper: Kniebeuge, Rumänisches Kreuzheben (Beine, hintere Kette, Rumpf)',
      'Kniebeuge-Fokus + Planks (Beine, Gesäß, Rumpfstabilität)',
    ],
    easy: [
      'Oberkörper: Bankdrücken, Rudern, Überkopfdrücken (Brust, oberer Rücken, Schultern)',
      'Klimmzüge/Latzziehen & Rudern (Rücken, Bizeps, Haltung)',
    ],
    rest: [
      'Ruhetag: Mobilität, leichtes Cardio',
      'Ruhetag: Planks & Mobility (Rumpf, Beweglichkeit)',
    ],
    supplements: [
      'Nordics & Wadenheben (Prävention)',
      'Klimmzüge (Rücken, Bizeps)',
    ],
  },
  team: {
    hard: [
      'Sprints 8 × 30 m (Schnelligkeit, Antritt)',
      'Richtungswechsel-Drills + Sprünge (Agilität, Bremskraft, Sprungkraft)',
      'Sprungkraft: Kniehebe- & Hürdensprünge (Schnellkraft)',
    ],
    easy: [
      'Koordinationsleiter + Technik (Fußarbeit, Schrittfrequenz)',
      'Lockere Ausdauer (Grundlage, Erholung zwischen harten Tagen)',
    ],
    rest: [
      'Ruhetag: Regeneration, Mobility',
      'Ruhetag: lockeres Einlaufen, Dehnen',
    ],
    supplements: [
      'Ausfallschritte & Kniebeugen (Beinkraft, Kniestabilität)',
      'Nordic Hamstring (Hamstrings, Verletzungsprävention)',
    ],
  },
  combat: {
    hard: [
      'Sparring (Timing, Distanzgefühl, Wettkampfausdauer)',
      'Pratzenarbeit (Schlagkraft, Präzision, Kondition)',
      'Konditionszirkel: Burpees, Seilspringen, Kettlebell-Swings (Ausdauer, Explosivität)',
    ],
    easy: [
      'Technikdrills & Kombinationen (saubere Technik, Reaktion)',
      'Schattenkampf (Beweglichkeit, Technik ohne Partner)',
    ],
    rest: [
      'Ruhetag: Mobility & Dehnen (Beweglichkeit, Prävention)',
      'Ruhetag: Atemarbeit, lockeres Schattenkampfen',
    ],
    supplements: [
      'Rumpf: Russian Twists, Beinheben (Rotationskraft, Schlagübertragung)',
      'Zusatz: explosive Kombinationen am Sack',
    ],
  },
}

/** Ergänzung für einen Tag (null an Ruhetagen oder ohne Ergänzungen). */
function supplementFor(sport: Sport, kind: DayKind, i: number): string | null {
  const lib = WORKOUT_LIBRARY[sport]
  if (kind === 'rest' || lib.supplements.length === 0) return null
  return lib.supplements[i % lib.supplements.length]
}

/** Haupt-Einheiten (ohne Ergänzung), aus denen pro Tag gewählt werden kann. */
export function workoutOptionsFor(sport: Sport, kind: DayKind): string[] {
  const lib = WORKOUT_LIBRARY[sport]
  return kind === 'hard' ? lib.hard : kind === 'easy' ? lib.easy : lib.rest
}

/** Automatisch rotierende Einheit (inkl. Ergänzung) für einen Tag. */
export function workoutFor(sport: Sport, kind: DayKind, seed = 0, dayIndex = 0): string {
  const pool = workoutOptionsFor(sport, kind)
  const main = pool[(seed + dayIndex) % pool.length]
  const extra = supplementFor(sport, kind, seed + dayIndex)
  return extra ? `${main} · Ergänzung: ${extra}` : main
}

/** Hängt die Tages-Ergänzung an eine vom Nutzer gewählte Haupt-Einheit. */
export function withSupplement(sport: Sport, kind: DayKind, dayIndex: number, main: string): string {
  const extra = supplementFor(sport, kind, dayIndex)
  return extra ? `${main} · Ergänzung: ${extra}` : main
}

/** Anzeige-Name der Sportart. */
export function sportLabel(sport: Sport): string {
  const labels: Record<Sport, string> = {
    running: 'Laufen',
    cycling: 'Radfahren',
    strength: 'Kraftsport',
    team: 'Teamsport',
    combat: 'Kampfsport',
  }
  return labels[sport]
}
