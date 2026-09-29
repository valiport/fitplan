// Wochenansicht: 7 Kalorien-Balken (Mo..So), Färbung nach Tagesart.
// Optik: Liquid-Glass-Panel, Klick wählt den Tag aus.

import type { WeekPlan } from '../domain/types'
import { WEEKDAY_LABELS, formatKcal } from '../domain/dates'
import type { DayPlan } from '../domain/types'

const KIND_COLOR: Record<DayPlan['kind'], string> = {
  hard: 'bg-gradient-to-t from-[#ff8a80] to-[#f2624f]', // harte Tage
  easy: 'bg-gradient-to-t from-[#ffd166] to-[#f5b73f]', // leichte Tage
  rest: 'bg-gradient-to-t from-[#9dbdb6] to-[#5d847c]', // Ruhetage
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
    <div className="w-full">
      <div className="glass-inset flex h-36 items-end justify-between gap-1 p-1.5">
        {plan.days.map((day, i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            title={`${WEEKDAY_LABELS[i]}: ${formatKcal(day.kcal)}`}
            className={
              'flex h-full flex-1 cursor-pointer flex-col items-center justify-end gap-0.5 rounded-[10px] p-0.5 transition ' +
              (selected === i ? 'bg-gradient-to-b from-[#5fe3d4]/70 to-[#14806f]/70 shadow-[0_2px_10px_rgba(20,150,135,0.35)]' : 'hover:bg-white/12')
            }
          >
            <span className={'text-[10px] font-bold ' + (selected === i ? 'text-[#04231f]' : 'text-[#dcefec]')}>
              {Math.round(day.kcal)}
            </span>
            <div className={'w-full rounded-t-[14px] rounded-b-[6px] ' + KIND_COLOR[day.kind]} style={{ height: `${Math.max(8, (day.kcal / max) * 100)}%` }} />
            <span className={'text-[10px] font-semibold ' + (selected === i ? 'text-[#04231f]' : 'text-[#a9c4be]')}>
              {WEEKDAY_LABELS[i]}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-center gap-3 text-[10px] text-[#a9c4be]">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f2624f]" />Hart</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#f5b73f]" />Leicht</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#7fa9a1]" />Ruhe</span>
      </div>
    </div>
  )
}
