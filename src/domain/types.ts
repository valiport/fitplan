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

export interface Meal {
  /** 'breakfast' | 'lunch' | 'snack' | 'dinner' */
  slot: MealSlot
  name: string
  kcal: number
  items: Ingredient[]
}

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export interface DayPlan {
  kind: DayKind
  /** Kurze Beschreibung der Trainingseinheit an diesem Tag. */
  workout: string
  kcal: number
  meals: Meal[]
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
