// Baut den Wochenplan: Tagesarten + Einheiten pro Sportart, Kalorien pro Tag,
// je 4 Mahlzeiten aus dem Rezept-Pool (nach Ernährungsform gefiltert),
// Mengen linear aufs Kalorienziel skaliert.

import { RECIPES } from './recipes'
import { dayKcal, mealSplit } from './nutrition'
import { buildWeekKinds, workoutFor, workoutOptionsFor, withSupplement } from './training'
import { toISODate } from './dates'
import type { DayPlan, Diet, Ingredient, Meal, MealSlot, Profile, WeekPlan, WorkoutOverrides } from './types'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner']

/** Rundet eine Zutatenmenge passend zur Einheit (g/ml auf 5, Stück/EL/Scheiben ganzzahlig). */
function scaleIngredient(item: Ingredient, factor: number): Ingredient {
  if (item.unit === 'g' || item.unit === 'ml') {
    return { ...item, grams: Math.max(5, Math.round((item.grams * factor) / 5) * 5) }
  }
  return { ...item, grams: Math.max(1, Math.round(item.grams * factor)) }
}

/** Wählt pro Slot ein Rezept für die Ernährungsform (rotierend via seed). */
function pickRecipe(slot: MealSlot, diet: Diet, seed: number) {
  const candidates = RECIPES.filter((r) => r.slot === slot && r.diets.includes(diet))
  if (candidates.length === 0) return undefined
  return candidates[seed % candidates.length]
}

export function buildWeekPlan(
  profile: Profile,
  weekStart: Date,
  seed = 0,
  workoutOverrides?: WorkoutOverrides,
): WeekPlan {
  const kinds = buildWeekKinds(profile.trainingDays)
  const days: DayPlan[] = kinds.map((kind, i) => {
    const kcal = dayKcal(profile, kind)
    const splits = mealSplit(kind)
    // Nutzer-Wahl pro Tag hat Vorrang; ungültige (z. B. nach Sportwechsel)
    // Einträge werden ignoriert und fallen auf die Auto-Rotation zurück.
    const chosen = workoutOverrides?.[i]
    const auto = workoutFor(profile.sport, kind, seed, i)
    const workout =
      chosen !== undefined && workoutOptionsFor(profile.sport, kind).includes(chosen)
        ? withSupplement(profile.sport, kind, i, chosen)
        : auto
    const meals: Meal[] = SLOTS.map((slot, slotIndex) => {
      const recipe = pickRecipe(slot, profile.diet, i + slotIndex * 3 + seed)
      const target = Math.round(kcal * splits[slotIndex])
      if (!recipe) {
        return { slot, name: 'Kein Rezept verfügbar', kcal: target, items: [] }
      }
      const factor = target / recipe.baseKcal
      const clamped = Math.min(2.2, Math.max(0.6, factor))
      return {
        slot,
        name: recipe.name,
        kcal: target,
        items: recipe.items.map((it) => scaleIngredient(it, clamped)),
      }
    })
    return { kind, workout, kcal, meals }
  })
  return { weekStart: toISODate(weekStart), days }
}
