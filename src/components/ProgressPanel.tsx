// Fortschritt: Gewicht anpassen (gratis) und Kalorien-Übersicht.
// Gewicht ist der Kern; die Detail-Übersicht ist Pro-Feature.

import { useState } from 'react'
import type { Profile, WeightEntry } from '../domain/types'
import { basalMetabolism, dayKcal } from '../domain/nutrition'
import { formatKg } from '../domain/dates'

export default function ProgressPanel({
  profile,
  entries,
  onAdd,
  isPro,
}: {
  profile: Profile
  entries: WeightEntry[]
  onAdd: (kg: number) => boolean
  isPro: boolean
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const kg = Number(text.replace(',', '.'))
    if (!onAdd(kg)) {
      setError('Bitte ein sinnvolles Gewicht (30–300 kg) angeben.')
      return
    }
    setError(null)
    setText('')
  }

  const latest = entries[0]
  const trend =
    entries.length >= 2 ? entries[0].kg - entries[entries.length - 1].kg : null

  return (
    <div className="w-full max-w-md text-left">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Heutiges Gewicht (kg)"
          aria-label="Heutiges Gewicht in kg"
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 placeholder:text-gray-500 outline-none focus:border-cyan-400"
        />
        <button
          onClick={submit}
          className="shrink-0 rounded-lg bg-cyan-500 px-4 py-2 font-medium text-gray-950 transition hover:bg-cyan-400"
        >
          Eintragen
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>}

      {latest && (
        <p className="mt-2 text-sm text-gray-400">
          Aktuell: <span className="font-medium text-gray-200">{formatKg(latest.kg)}</span>
          {trend !== null && (
            <> · Veränderung: <span className={trend <= 0 ? 'text-teal-400' : 'text-amber-400'}>{trend > 0 ? '+' : ''}{trend.toFixed(1)} kg</span></>
          )}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-gray-500">
          {entries.slice(0, 5).map((e) => (
            <li key={e.date} className="flex justify-between">
              <span>{e.date}</span>
              <span>{formatKg(e.kg)}</span>
            </li>
          ))}
        </ul>
      )}

      {isPro ? (
        <div className="mt-4 rounded-lg bg-gray-800/60 px-3 py-3">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Kalorien-Übersicht (Pro)
          </h3>
          <ul className="text-sm text-gray-300">
            <li className="flex justify-between"><span>Grundumsatz</span><span className="tabular-nums">{basalMetabolism(profile)} kcal</span></li>
            <li className="flex justify-between"><span>Harter Tag</span><span className="tabular-nums">{dayKcal(profile, 'hard')} kcal</span></li>
            <li className="flex justify-between"><span>Leichter Tag</span><span className="tabular-nums">{dayKcal(profile, 'easy')} kcal</span></li>
            <li className="flex justify-between"><span>Ruhetag</span><span className="tabular-nums">{dayKcal(profile, 'rest')} kcal</span></li>
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-gray-600 px-3 py-3 text-center">
          <p className="text-sm text-gray-400">Kalorien-Übersicht & Verlaufsanalyse</p>
          <p className="mt-0.5 text-xs text-gray-500">Pro-Feature</p>
        </div>
      )}
    </div>
  )
}
