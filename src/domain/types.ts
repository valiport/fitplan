// Domänen-Typen des Planers.

export type Sport = 'running' | 'cycling' | 'strength' | 'team' | 'combat'

export type Goal = 'lose' | 'maintain' | 'gain'

export type Diet = 'omnivore' | 'vegetarian' | 'vegan'

/** Intensität eines einzelnen Tages in der Woche. */
export type DayKind = 'hard' | 'easy' | 'rest'

export interface Profile {
  sport: Sport
  goal: Goal
  diet: Diet
  /** Alter in Jahren. */
  age: number
  /** Geschlecht für die Kalorienformel. */
  sex: 'male' | 'female'
  /** Größe in cm. */
  heightCm: number
  /** Gewicht in kg. */
  weightKg: number
  /** Anzahl Trainingstage pro Woche (1–6). */
  trainingDays: number
}

/** Eine Zutat mit Menge, wie sie im Tagesplan und in der Einkaufsliste erscheint. */
export interface Ingredient {
  name: string
  grams: number
  unit: 'g' | 'ml' | 'Stück' | 'EL' | 'Scheiben'
}

/** Ausrüstung, die für eine Übung nötig ist. */
export type Equipment =
  | 'none' // Körpergewicht
  | 'dumbbells' // Kurzhanteln
  | 'barbell' // Langhantel
  | 'bands' // Widerstandsbänder
  | 'pullup' // Klimmzughilfe / Reckstange
  | 'kettlebell'
  | 'bench' // Bank
  | 'bike' // Fahrrad
  | 'gym' // Studio-Zugang
  | 'track' // Laufbahn/Tartanbahn
  | 'balls' // Bälle für Teamsport-Drills
  | 'pads' // Pratzen/Sack

export interface Meal {
  /** 'breakfast' | 'lunch' | 'snack' | 'dinner' */
  slot: MealSlot
  name: string
  kcal: number
  items: Ingredient[]
  /** Kochanleitung als nummerierte Schritte. */
  steps: string[]
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export interface DayPlan {
  kind: DayKind
  /** Kurze Beschreibung der Trainingseinheit an diesem Tag. */
  workout: string
  /** Ausführliche Beschreibung der Einheit: So geht's, Dauer, Intensität, Tipps. */
  workoutGuide?: WorkoutGuide
  /** Gerätebedarf der gewählten Haupteinheit. */
  workoutEquipment?: Equipment[]
  kcal: number
  meals: Meal[]
}

/** Ausführliche Beschreibung einer Trainingseinheit. */
export interface WorkoutGuide {
  /** Kurze Zusammenfassung: Worum es geht. */
  summary: string
  /** Ausführung als nummerierte Schritte. */
  howTo: string[]
  /** Geplante Dauer. */
  duration: string
  /** Intensitätsangabe (z. B. HFmax-Bereich). */
  intensity: string
  /** Praktische Hinweise. */
  tips: string[]
  /** Ausrüstung, die man für die Einheit braucht. */
  equipment: Equipment[]
}

export interface WeekPlan {
  /** ISO-Datum (YYYY-MM-DD) des Montags. */
  weekStart: string
  days: DayPlan[] // immer 7 Einträge, Mo..So
}

/** Fortschritts-Eintrag: Gewicht in kg an einem Tag. */
export interface WeightEntry {
  date: string // ISO-Datum
  kg: number
}

/** Frei gewählte Haupt-Einheit pro Wochentag (Index 0 = Montag). */
export type WorkoutOverrides = Record<number, string>

/** Schlüssel einer Übung in der Bibliothek. */
export type WorkoutKey =
  | 'rest-day-mobility'
  | 'running-hard-intervals-800'
  | 'running-hard-tempo'
  | 'running-hard-intervals-400'
  | 'running-easy-long'
  | 'running-easy-steady'
  | 'running-easy-abc'
  | 'cycling-hard-intervals-8min'
  | 'cycling-hard-threshold'
  | 'cycling-hard-hills'
  | 'cycling-easy-base'
  | 'cycling-easy-long'
  | 'strength-hard-lower'
  | 'strength-hard-squat-core'
  | 'strength-hard-bodyweight-legs'
  | 'strength-hard-bodyweight-unilateral'
  | 'strength-hard-bodyweight-full'
  | 'strength-easy-upper'
  | 'strength-easy-pull'
  | 'strength-easy-bodyweight-push'
  | 'strength-easy-bodyweight-posture'
  | 'strength-easy-bodyweight-core'
  | 'team-hard-sprints'
  | 'team-hard-agility'
  | 'team-hard-jumps'
  | 'team-easy-coordination'
  | 'team-easy-aerobic'
  | 'combat-hard-sparring'
  | 'combat-hard-pads'
  | 'combat-hard-circuit'
  | 'combat-easy-technique'
  | 'combat-easy-shadow'

/** Welche Ausrüstung der Nutzer hat (Pro-Feature). */
export type EquipmentSet = Equipment[]
