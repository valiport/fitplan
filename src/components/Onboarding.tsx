// Onboarding: sammelt Profil-Daten, validiert sie und startet den Planer.

import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Diet, Goal, Profile, Sport } from '../domain/types'
import { sportLabel } from '../domain/training'

const SPORTS: Sport[] = ['running', 'cycling', 'strength', 'team', 'combat']
const GOALS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Abnehmen' },
  { value: 'maintain', label: 'Gewicht halten' },
  { value: 'gain', label: 'Aufbauen' },
]
const DIETS: { value: Diet; label: string }[] = [
  { value: 'omnivore', label: 'Omnivor' },
  { value: 'vegetarian', label: 'Vegetarisch' },
  { value: 'vegan', label: 'Vegan' },
]

export default function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [sport, setSport] = useState<Sport>('strength')
  const [goal, setGoal] = useState<Goal>('maintain')
  const [diet, setDiet] = useState<Diet>('omnivore')
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [age, setAge] = useState('28')
  const [heightCm, setHeightCm] = useState('180')
  const [weightKg, setWeightKg] = useState('75')
  const [trainingDays, setTrainingDays] = useState('4')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    // de-DE: Komma als Dezimaltrenner erlauben (konsistent mit ProgressPanel).
    const a = Number(age.replace(',', '.'))
    const h = Number(heightCm.replace(',', '.'))
    const w = Number(weightKg.replace(',', '.'))
    const t = Number(trainingDays)
    if (!Number.isFinite(a) || a < 14 || a > 90) return setError('Bitte Alter zwischen 14 und 90 angeben.')
    if (!Number.isFinite(h) || h < 120 || h > 230) return setError('Bitte Größe zwischen 120 und 230 cm angeben.')
    if (!Number.isFinite(w) || w < 35 || w > 250) return setError('Bitte Gewicht zwischen 35 und 250 kg angeben.')
    if (!Number.isInteger(t) || t < 1 || t > 6) return setError('Bitte 1–6 Trainingstage pro Woche wählen.')
    setError(null)
    onDone({ sport, goal, diet, sex, age: a, heightCm: h, weightKg: w, trainingDays: t })
  }

  const field = 'w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100 outline-none focus:border-cyan-400'
  const label = 'mb-1 block text-sm text-gray-400'

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-gray-800/60 p-6 text-left">
      <h2 className="mb-4 text-xl font-semibold text-gray-100">Dein Profil</h2>

      <div className="mb-3">
        <span className={label}>Sportart</span>
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSport(s)}
              className={
                'rounded-lg px-3 py-1.5 text-sm transition ' +
                (sport === s
                  ? 'bg-cyan-500 font-medium text-gray-950'
                  : 'bg-gray-900 text-gray-300 hover:bg-gray-700')
              }
            >
              {sportLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div>
          <span className={label}>Ziel</span>
          <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className={field}>
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
        <div>
          <span className={label}>Ernährung</span>
          <select value={diet} onChange={(e) => setDiet(e.target.value as Diet)} className={field}>
            {DIETS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <span className={label}>Geschlecht</span>
          <select value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')} className={field}>
            <option value="male">Männlich</option>
            <option value="female">Weiblich</option>
          </select>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div>
          <label className={label} htmlFor="ob-age">Alter</label>
          <input id="ob-age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="ob-height">Größe (cm)</label>
          <input id="ob-height" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="numeric" className={field} />
        </div>
        <div>
          <label className={label} htmlFor="ob-weight">Gewicht (kg)</label>
          <input id="ob-weight" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" className={field} />
        </div>
      </div>

      <div className="mb-4">
        <span className={label}>Trainingstage pro Woche</span>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTrainingDays(String(n))}
              className={
                'h-9 w-9 rounded-lg text-sm transition ' +
                (Number(trainingDays) === n
                  ? 'bg-cyan-500 font-medium text-gray-950'
                  : 'bg-gray-900 text-gray-300 hover:bg-gray-700')
              }
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 font-medium text-gray-950 transition hover:bg-cyan-400"
      >
        Wochenplan erstellen
      </button>

      <p className="mt-3 text-xs text-gray-500">
        Die Berechnung ist eine Schätzung und ersetzt keine Ernährungsberatung.
      </p>
    </form>
  )
}
