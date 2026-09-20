// Tagesplan: Trainingseinheit + 4 Mahlzeiten mit konkreten Mengen.
// Training und Mahlzeiten sind abhakbar (pro Woche persistiert).
// Die Trainingseinheit lässt sich pro Tag aus dem Sport-Pool frei wählen.

import type { DayPlan, Sport } from '../domain/types'
import { workoutOptionsFor } from '../domain/training'
import { formatKcal } from '../domain/dates'

const MEAL_LABEL: Record<DayPlan['meals'][number]['slot'], string> = {
  breakfast: 'Frühstück',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Abend',
}

const KIND_LABEL: Record<DayPlan['kind'], string> = {
  hard: 'Harter Tag',
  easy: 'Leichter Tag',
  rest: 'Ruhetag',
}

export default function DayView({
  day,
  dayIndex,
  checked,
  onToggle,
  sport,
  override,
  onOverride,
}: {
  day: DayPlan
  dayIndex: number
  checked: Set<string>
  onToggle: (id: string) => void
  sport: Sport
  override?: string
  onOverride: (workout: string | null) => void
}) {
  const checkId = (what: string, i: number) => `d${dayIndex}-${what}-${i}`
  const done = (id: string) => checked.has(id)
  const options = workoutOptionsFor(sport, day.kind)
  const selectedWorkout = override !== undefined && options.includes(override) ? override : 'auto'

  return (
    <div className="w-full max-w-md text-left">
      <div className="mb-3 rounded-lg bg-gray-800/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {KIND_LABEL[day.kind]}
          </span>
          <button
            onClick={() => onToggle(checkId('workout', 0))}
            className={
              'shrink-0 rounded-full border px-3 py-1 text-xs transition ' +
              (done(checkId('workout', 0))
                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                : 'border-gray-600 text-gray-400 hover:border-cyan-400 hover:text-cyan-300')
            }
          >
            {done(checkId('workout', 0)) ? '✓ Training erledigt' : 'Training abhaken'}
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-100">{day.workout}</p>
        <label className="mt-2 block text-xs text-gray-500" htmlFor={`workout-choice-${dayIndex}`}>
          Einheit auswählen
        </label>
        <select
          id={`workout-choice-${dayIndex}`}
          value={selectedWorkout}
          onChange={(event) => onOverride(event.target.value === 'auto' ? null : event.target.value)}
          className="mt-1 w-full rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-xs text-gray-200 focus:border-cyan-400 focus:outline-none"
        >
          <option value="auto">Auto (Rotation)</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {day.meals.map((meal, i) => {
          const id = checkId('meal', i)
          return (
            <div key={i} className="rounded-lg bg-gray-800/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {MEAL_LABEL[meal.slot]}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatKcal(meal.kcal)}</span>
                  <button
                    onClick={() => onToggle(id)}
                    aria-pressed={done(id)}
                    className={
                      'rounded-full border px-2.5 py-0.5 text-xs transition ' +
                      (done(id)
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                        : 'border-gray-600 text-gray-400 hover:border-cyan-400 hover:text-cyan-300')
                    }
                  >
                    {done(id) ? '✓' : 'Abhaken'}
                  </button>
                </div>
              </div>
              <p className="mt-1 font-medium text-gray-100">{meal.name}</p>
              <ul className="mt-1 text-sm text-gray-400">
                {meal.items.map((item, j) => (
                  <li key={j}>
                    {item.name}: {item.grams} {item.unit}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
