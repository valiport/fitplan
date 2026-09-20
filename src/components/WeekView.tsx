// Wochenansicht: 7 Balken (Kalorien je Tag), Färbung nach Tagesart,
// Klick auf einen Tag öffnet die Tagesansicht.

import type { WeekPlan } from '../domain/types'
import { WEEKDAY_LABELS, formatKcal } from '../domain/dates'
import type { DayPlan } from '../domain/types'

const KIND_COLOR: Record<DayPlan['kind'], string> = {
  hard: 'bg-cyan-500',
  easy: 'bg-teal-500/70',
  rest: 'bg-gray-600',
}

export default function WeekView({
  plan,
  selected,
  onSelect,
}: {
  plan: WeekPlan
  selected: number
  onSelect: (index: number) => void
}) {
  const max = Math.max(...plan.days.map((d) => d.kcal), 1)

  return (
    <div className="w-full max-w-md">
      <div className="flex h-40 items-end justify-between gap-2">
        {plan.days.map((day, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            title={`${WEEKDAY_LABELS[i]}: ${formatKcal(day.kcal)}`}
            className={
              'flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-1 rounded-lg p-1 transition ' +
              (selected === i ? 'bg-gray-800 ring-1 ring-cyan-400' : 'hover:bg-gray-800/50')
            }
          >
            <span className="text-[10px] text-gray-400">{Math.round(day.kcal)}</span>
            <div
              className={'w-full rounded-sm ' + KIND_COLOR[day.kind]}
              style={{ height: `${Math.max(8, (day.kcal / max) * 100)}%` }}
            />
            <span className="text-xs text-gray-400">{WEEKDAY_LABELS[i]}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-gray-400">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-cyan-500" />Hart</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-500/70" />Leicht</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gray-600" />Ruhe</span>
      </div>
      <p className="mt-3 text-center text-xs text-gray-500">
        Harte Tage bekommen mehr Kohlenhydrate, Ruhetage weniger.
      </p>
    </div>
  )
}
