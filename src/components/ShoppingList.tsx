// Einkaufsliste: entsteht automatisch aus dem Wochenplan.
// Umschaltbar: ganze Woche oder nur die Tage, deren Training abgehakt ist.

import { useMemo, useState } from 'react'
import type { WeekPlan } from '../domain/types'
import { buildShoppingList, shoppingListToText } from '../domain/shopping'

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
    <div className="w-full max-w-md text-left">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
          Einkaufsliste ({lines.length} Positionen)
        </h3>
        <button
          onClick={() => setOnlyDone((v) => !v)}
          className={
            'rounded-full border px-3 py-1 text-xs transition ' +
            (onlyDone
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
              : 'border-gray-600 text-gray-400 hover:border-cyan-400 hover:text-cyan-300')
          }
        >
          {onlyDone ? 'Nur abgehakte Tage' : 'Ganze Woche'}
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-lg bg-gray-800/60 px-3 py-3 text-sm text-gray-500">
          Keine Positionen{onlyDone ? ' – hake zuerst Trainingstage ab.' : '.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1 rounded-lg bg-gray-800/60 px-3 py-2 text-sm">
          {lines.map((l) => (
            <li key={`${l.name}-${l.unit}`} className="flex justify-between gap-3 text-gray-300">
              <span className="min-w-0 truncate">{l.name}</span>
              <span className="shrink-0 tabular-nums text-gray-400">
                {l.buyAmount} {l.unit}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={copy}
        disabled={lines.length === 0}
        className="mt-2 w-full rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {copied ? '✓ Kopiert' : 'Liste kopieren'}
      </button>
    </div>
  )
}
