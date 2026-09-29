// Fortschritt: Gewicht anpassen (gratis) und Kalorien-Übersicht (Pro).
// Optik: Liquid Glass (Glas-Formular, Glass-GroupBoxen).

import { useState } from 'react'
import type { Profile, WeightEntry } from '../domain/types'
import { basalMetabolism, dayKcal } from '../domain/nutrition'
import { formatKg } from '../domain/dates'
import { XpButton, XpGroupBox, XpStatusBox } from './ui'

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
  const trend = entries.length >= 2 ? entries[0].kg - entries[entries.length - 1].kg : null

  return (
    <div className="text-left">
      <XpGroupBox title="Gewicht eintragen">
        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Heute (kg)"
            aria-label="Heutiges Gewicht in kg"
            inputMode="decimal"
            className="glass-input min-w-0 flex-1 !w-auto"
          />
          <XpButton variant="primary" onClick={submit}>Eintragen</XpButton>
        </div>
        {error && <p role="alert" className="mt-1 text-[11px] text-[#ff9b92]">{error}</p>}

        {latest && (
          <p className="mt-1.5 text-[12px] text-[#a9c4be]">
            Aktuell: <span className="font-bold">{formatKg(latest.kg)}</span>
            {trend !== null && (
              <>
                {' '}· Veränderung:{' '}
                <span className={trend <= 0 ? 'font-bold text-[#5fd9a6]' : 'font-bold text-[#ffb35c]'}>
                  {trend > 0 ? '+' : ''}{trend.toFixed(1)} kg
                </span>
              </>
            )}
          </p>
        )}

        {entries.length > 0 && (
          <ul className="mt-1 max-h-28 overflow-y-auto text-[11px] text-[#9fb9b4]">
            {entries.slice(0, 5).map((e) => (
              <li key={e.date} className="flex justify-between border-b border-dotted border-[#3a5a54] py-0.5">
                <span>{e.date}</span>
                <span>{formatKg(e.kg)}</span>
              </li>
            ))}
          </ul>
        )}
      </XpGroupBox>

      {isPro ? (
        <XpGroupBox title="Kalorien-Übersicht (Pro)" className="mt-2">
          <ul className="text-[12px] text-[#dcefec]">
            <li className="flex justify-between"><span>Grundumsatz</span><span className="tabular-nums">{basalMetabolism(profile)} kcal</span></li>
            <li className="flex justify-between"><span>Harter Tag</span><span className="tabular-nums">{dayKcal(profile, 'hard')} kcal</span></li>
            <li className="flex justify-between"><span>Leichter Tag</span><span className="tabular-nums">{dayKcal(profile, 'easy')} kcal</span></li>
            <li className="flex justify-between"><span>Ruhetag</span><span className="tabular-nums">{dayKcal(profile, 'rest')} kcal</span></li>
          </ul>
        </XpGroupBox>
      ) : (
        <XpStatusBox className="mt-2">
          <p className="text-[12px] text-[#a9c4be]">Kalorien-Übersicht & Verlaufsanalyse</p>
          <p className="text-[10px] text-[#8bada7]">Pro-Feature</p>
        </XpStatusBox>
      )}
    </div>
  )
}
