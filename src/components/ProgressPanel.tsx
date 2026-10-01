// Fortschritt: Gewicht eintragen (gratis), Kalorien-Übersicht (Pro) und die
// neuen Pro-Extras: Gewichts-Verlaufschart mit Zielprognose (inkl. PNG-Export)
// sowie Wochenstatistik (Erfolgsquote + geplante Kalorien). Liquid-Chrome-Optik.

import { useMemo, useState } from 'react'
import type { Profile, WeekPlan, WeightEntry } from '../domain/types'
import { basalMetabolism, dayKcal } from '../domain/nutrition'
import { formatKg } from '../domain/dates'
import { XpButton, XpGroupBox, XpStatusBox } from './ui'
import { buildChartPlan, downloadWeightChart, profileTargetGuess } from '../domain/chart'
import { computeWeekStats } from '../hooks/useStreak'

export default function ProgressPanel({
  profile,
  plan,
  checked,
  entries,
  onAdd,
  isPro,
}: {
  profile: Profile
  plan: WeekPlan
  checked: Set<string>
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
        <>
          <WeightChartCard entries={entries} />

          <XpGroupBox title="Kalorien-Übersicht (Pro)" className="mt-2">
            <ul className="text-[12px] text-[#dcefec]">
              <li className="flex justify-between"><span>Grundumsatz</span><span className="tabular-nums">{basalMetabolism(profile)} kcal</span></li>
              <li className="flex justify-between"><span>Harter Tag</span><span className="tabular-nums">{dayKcal(profile, 'hard')} kcal</span></li>
              <li className="flex justify-between"><span>Leichter Tag</span><span className="tabular-nums">{dayKcal(profile, 'easy')} kcal</span></li>
              <li className="flex justify-between"><span>Ruhetag</span><span className="tabular-nums">{dayKcal(profile, 'rest')} kcal</span></li>
            </ul>
          </XpGroupBox>

          <WeekStatsCard plan={plan} checked={checked} />
        </>
      ) : (
        <>
          <XpStatusBox className="mt-2">
            <p className="text-[12px] text-[#a9c4be]">Gewichts-Verlaufschart & Zielprognose</p>
            <p className="text-[10px] text-[#8bada7]">Pro-Feature</p>
          </XpStatusBox>
          <XpStatusBox className="mt-2">
            <p className="text-[12px] text-[#a9c4be]">Kalorien-Übersicht & Verlaufsanalyse</p>
            <p className="text-[10px] text-[#8bada7]">Pro-Feature</p>
          </XpStatusBox>
          <XpStatusBox className="mt-2">
            <p className="text-[12px] text-[#a9c4be]">Wochenstatistik: Erfolgsquote & Kalorien-Bilanz</p>
            <p className="text-[10px] text-[#8bada7]">Pro-Feature</p>
          </XpStatusBox>
        </>
      )}
    </div>
  )
}

/** SVG-Verlaufschart der Gewichtseinträge mit Trend- und Zielprognose. */
function WeightChartCard({ entries }: { entries: WeightEntry[] }) {
  const chart = useMemo(() => buildChartPlan(entries, profileTargetGuess(entries)), [entries])
  return (
    <XpGroupBox title="Gewichts-Verlauf (Pro)" className="mt-2">
      <svg
        viewBox="0 0 320 120"
        role="img"
        aria-label="Gewichtsverlauf der letzten Einträge"
        className="h-auto w-full"
      >
        {/* Rasterlinien */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2="320"
            y1={12 + f * 96}
            y2={12 + f * 96}
            stroke="rgba(235,255,251,0.12)"
            strokeDasharray="3 4"
          />
        ))}
        {/* Verlaufslinie */}
        {chart.points && (
          <polyline
            points={chart.points}
            fill="none"
            stroke="#5fe3d4"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* Punkte */}
        {chart.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="2.5" fill="#0a1a17" stroke="#5fe3d4" strokeWidth="1.5" />
        ))}
        {/* Prognose gestrichelt */}
        {chart.forecast && (
          <line
            x1={chart.forecast.x1}
            y1={chart.forecast.y1}
            x2={chart.forecast.x2}
            y2={chart.forecast.y2}
            stroke="#ffcf7e"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}
      </svg>
      <p className="mt-1 text-[11px] text-[#9fb9b4]">{chart.caption}</p>
      <XpButton className="mt-1.5 w-full" onClick={() => downloadWeightChart(entries, chart.caption)}>
        🖼 Chart als PNG exportieren
      </XpButton>
    </XpGroupBox>
  )
}

/** Wochenstatistik: Erfolgsquote der Trainings-Checks + geplante Kalorien. */
function WeekStatsCard({ plan, checked }: { plan: WeekPlan; checked: Set<string> }) {
  const stats = useMemo(() => computeWeekStats(plan, (id) => checked.has(id)), [plan, checked])
  return (
    <XpGroupBox title="Wochenstatistik (Pro)" className="mt-2">
      <ul className="text-[12px] text-[#dcefec]">
        <li className="flex justify-between">
          <span>Trainings erledigt</span>
          <span className="tabular-nums">{stats.doneWorkouts} / {stats.totalWorkouts}</span>
        </li>
        <li className="flex justify-between">
          <span>Erfolgsquote</span>
          <span className="tabular-nums font-bold text-[#5fe3d4]">{stats.successRate}%</span>
        </li>
        <li className="flex justify-between">
          <span>Geplante Kalorien (Woche)</span>
          <span className="tabular-nums">{stats.weekKcal.toLocaleString('de-DE')} kcal</span>
        </li>
      </ul>
    </XpGroupBox>
  )
}
