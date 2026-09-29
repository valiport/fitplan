// Ausrüstungs-Katalog & Filterung (Pro-Feature).
// Nutzer (Pro) legen fest, welche Geräte sie haben; der Planer passt die
// Auswahl der Einheiten daran an. Ein Studio deckt die meisten Gewichte ab.

import { workoutOptionsFor, WORKOUT_GUIDES } from './training'
import type { DayKind, Equipment, EquipmentSet, Sport, WorkoutKey } from './types'

export interface EquipmentInfo {
  id: Equipment
  label: string
  hint: string
}

export const EQUIPMENT_CATALOG: EquipmentInfo[] = [
  { id: 'none', label: 'Körpergewicht', hint: 'Nichts nötig — überall machbar' },
  { id: 'dumbbells', label: 'Kurzhanteln', hint: 'Verstellbar oder fixe Paare' },
  { id: 'barbell', label: 'Langhantel', hint: 'Mit Stangen-Abbrüchen' },
  { id: 'bands', label: 'Widerstandsbänder', hint: 'Verschiedene Stärken' },
  { id: 'pullup', label: 'Reckstange', hint: 'Für Klimmzüge & Latzziehen' },
  { id: 'kettlebell', label: 'Kettlebell', hint: 'Für Swings & Zirkel' },
  { id: 'bench', label: 'Trainingsbank', hint: 'Flach reicht' },
  { id: 'bike', label: 'Fahrrad', hint: 'Straße, MTB oder Trainer' },
  { id: 'gym', label: 'Studio-Zugang', hint: 'Deckt die meisten Geräte ab' },
  { id: 'track', label: 'Laufbahn', hint: 'Für Intervalle & Sprints' },
  { id: 'balls', label: 'Bälle & Leiter', hint: 'Teamsport-Drills' },
  { id: 'pads', label: 'Pratzen/Sack', hint: 'Kampfsport-Ausrüstung' },
]

const EQUIPMENT_LABEL: Record<Equipment, string> = Object.fromEntries(
  EQUIPMENT_CATALOG.map((e) => [e.id, e.label]),
) as Record<Equipment, string>

export function equipmentLabel(id: Equipment): string {
  return EQUIPMENT_LABEL[id]
}

/**
 * Hat der Nutzer alle Geräte, die eine Einheit braucht?
 * 'gym' (Studio) deckt alle Gewichte/Bänke ab ('barbell', 'dumbbells',
 * 'bench', 'pullup', 'kettlebell'); Strecken-Ausrüstung ('track', 'bike',
 * 'balls', 'pads') ist real vor Ort nötig und wird nicht substituiert.
 */
export function hasEquipment(owned: EquipmentSet, needed: Equipment[]): boolean {
  return needed.every((req) => {
    if (owned.includes(req)) return true
    if (req === 'none') return true
    if (owned.includes('gym') && ['barbell', 'dumbbells', 'bench', 'pullup', 'kettlebell'].includes(req)) return true
    return false
  })
}

/** Einheiten einer Tagesart, die mit der vorhandenen Ausrüstung machbar sind. */
export function feasibleOptions(
  sport: Sport,
  kind: DayKind,
  owned: EquipmentSet | undefined,
): { key: WorkoutKey; label: string }[] {
  const options = workoutOptionsFor(sport, kind)
  if (!owned) return options // Gratis: kein Filter
  const feasible = options.filter((o) =>
    hasEquipment(owned, WORKOUT_GUIDES[o.key].equipment.map((item) => item === 'gym' ? 'barbell' : item)),
  )
  return feasible
}
