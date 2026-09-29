// Baut den Wochenplan: Tagesarten + Einheiten pro Sportart, Kalorien pro Tag,
// je 4 Mahlzeiten aus dem Rezept-Pool (nach Ernährungsform gefiltert),
// Mengen linear aufs Kalorienziel skaliert. Jede Mahlzeit bringt ihre
// Kochanleitung mit, jede Trainingseinheit einen detaillierten Guide.
// Pro-Nutzer bekommen zusätzlich eine auf ihre Geräte angepasste Auswahl.

import { RECIPES } from './recipes'
import { dayKcal, mealSplit } from './nutrition'
import { buildWeekKinds, guideFor, supplementEquipmentFor, supplementFor, workoutForWeek } from './training'
import { feasibleOptions, hasEquipment } from './equipment'
import { toISODate } from './dates'
import type { DayPlan, Diet, EquipmentSet, Ingredient, Meal, MealSlot, Profile, WeekPlan, WorkoutOverrides } from './types'

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
  equipmentSet?: EquipmentSet,
): WeekPlan {
  const kinds = buildWeekKinds(profile.trainingDays)
  const automaticByKind: Record<string, Set<string>> = {
    hard: new Set(),
    easy: new Set(),
    rest: new Set(),
  }
  const overrideLabelsByKind = new Map<string, Set<string>>()
  const effectiveOverrides: WorkoutOverrides = {}
  kinds.forEach((kind, i) => {
    const chosen = workoutOverrides?.[i]
    if (!chosen) return
    const option = feasibleOptions(profile.sport, kind, equipmentSet).find((o) => o.label === chosen)
    if (!option) return
    const labels = overrideLabelsByKind.get(kind) ?? new Set<string>()
    // Frühere Wochentage behalten bei bereits gespeicherten doppelten Wahlen
    // Vorrang; spätere fallen automatisch auf eine andere Einheit zurück.
    if (labels.has(option.label)) return
    labels.add(option.label)
    overrideLabelsByKind.set(kind, labels)
    effectiveOverrides[i] = option.label
  })

  const days: DayPlan[] = kinds.map((kind, i) => {
    const kcal = dayKcal(profile, kind)
    const splits = mealSplit(kind)
    // Nutzer-Wahl pro Tag hat Vorrang; ungültige (z. B. nach Sportwechsel
    // oder Gerätewechsel) Einträge fallen auf die gefilterte Auto-Rotation.
    const chosen = effectiveOverrides[i]
    const options = feasibleOptions(profile.sport, kind, equipmentSet)
    const chosenOption = chosen !== undefined ? options.find((o) => o.label === chosen) : undefined
    const rank = kinds.slice(0, i).filter((previousKind) => previousKind === kind).length
    const excludedLabels = new Set(automaticByKind[kind])
    for (const label of overrideLabelsByKind.get(kind) ?? []) excludedLabels.add(label)
    const selected = chosenOption ?? workoutForWeek(profile.sport, kind, seed, rank, options, excludedLabels)
    if (selected && !chosenOption) automaticByKind[kind].add(selected.label)
    const extraCandidate = supplementFor(profile.sport, kind, rank)
    const extra =
      extraCandidate &&
      (!equipmentSet || hasEquipment(equipmentSet, supplementEquipmentFor(profile.sport, rank)))
        ? extraCandidate
        : null
    const workout = selected
      ? extra ? `${selected.label} · Ergänzung: ${extra}` : selected.label
      : 'Keine passende Einheit mit den ausgewählten Geräten verfügbar.'
    const workoutGuide = selected ? guideFor(selected.key) : undefined
    const workoutEquipment = selected ? workoutGuide?.equipment : undefined
    const meals: Meal[] = SLOTS.map((slot, slotIndex) => {
      const recipe = pickRecipe(slot, profile.diet, i + slotIndex * 3 + seed)
      const target = Math.round(kcal * splits[slotIndex])
      if (!recipe) {
        return { slot, name: 'Kein Rezept verfügbar', kcal: target, items: [], steps: [] }
      }
      const factor = target / recipe.baseKcal
      const clamped = Math.min(2.2, Math.max(0.6, factor))
      return {
        slot,
        name: recipe.name,
        kcal: target,
        items: recipe.items.map((it) => scaleIngredient(it, clamped)),
        steps: recipe.steps,
      }
    })
    return { kind, workout, workoutGuide, workoutEquipment, kcal, meals }
  })
  return { weekStart: toISODate(weekStart), days }
}
