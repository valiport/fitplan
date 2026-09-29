// Einkaufsliste: entsteht automatisch aus dem Wochenplan.
// Umschaltbar: ganze Woche oder nur die Tage, deren Training abgehakt ist.
// Optik: Liquid Glass (Glas-Liste, Glass-Buttons).

import { useMemo, useState } from 'react'
import type { WeekPlan } from '../domain/types'
import { buildShoppingList, shoppingListToText } from '../domain/shopping'
import { XpButton } from './ui'

export default function ShoppingList({
  plan,
  checked,
}: {
  plan: WeekPlan
  checked: Set<string>
}) {
  const [onlyDone, setOnlyDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const lines = useMemo(
    () =>
      buildShoppingList(plan, onlyDone ? (dayIndex) => checked.has(`d${dayIndex}-workout-0`) : undefined),
    [plan, onlyDone, checked],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shoppingListToText(lines, plan.weekStart))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="text-left">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#5fe3d4]">
          Liste ({lines.length} Positionen)
        </h3>
        <XpButton
          onClick={() => setOnlyDone((v) => !v)}
          className={onlyDone ? 'font-bold' : ''}
        >
          {onlyDone ? 'Nur abgehakte Tage' : 'Ganze Woche'}
        </XpButton>
      </div>

      {lines.length === 0 ? (
        <p className="glass-inset p-2 text-[12px] text-[#8bada7]">
          Keine Positionen{onlyDone ? ' – hake zuerst Trainingstage ab.' : '.'}
        </p>
      ) : (
        <ul className="glass-inset max-h-72 divide-y divide-white/70 overflow-y-auto p-1 text-[12px]">
          {lines.map((l) => (
            <li key={`${l.name}-${l.unit}`} className="flex justify-between gap-3 px-1 py-0.5 text-[#dcefec]">
              <span className="min-w-0 truncate">{l.name}</span>
              <span className="shrink-0 tabular-nums text-[#a9c4be]">
                {l.buyAmount} {l.unit}
              </span>
            </li>
          ))}
        </ul>
      )}

      <XpButton onClick={copy} disabled={lines.length === 0} className="mt-1.5 w-full">
        {copied ? '✓ Kopiert' : 'Liste kopieren'}
      </XpButton>
    </div>
  )
}
