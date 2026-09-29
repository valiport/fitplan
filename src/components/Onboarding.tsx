// Onboarding: sammelt Profil-Daten, validiert sie und startet den Planer.
// Optik: Glass-Formular mit GroupBoxes und Glass-Buttons.

import { useState, type FormEvent } from 'react'
import type { Diet, Goal, Profile, Sport } from '../domain/types'
import { sportLabel } from '../domain/training'
import { XpButton, XpGroupBox } from './ui'

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

const FIELD = 'glass-input'
const LABEL = 'mb-0.5 block text-[12px] text-[#a9c4be]'

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

  const optionChip = (active: boolean) =>
    'glass-chip' + (active ? ' glass-chip-active' : '')

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 text-left">
      <XpGroupBox title="Sportart">
        <div className="flex flex-wrap gap-1.5">
          {SPORTS.map((s) => (
            <button key={s} type="button" onClick={() => setSport(s)} className={optionChip(sport === s)}>
              {sportLabel(s)}
            </button>
          ))}
        </div>
      </XpGroupBox>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <XpGroupBox title="Ziel">
          <select value={goal} onChange={(e) => setGoal(e.target.value as Goal)} className={FIELD}>
            {GOALS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </XpGroupBox>
        <XpGroupBox title="Ernährung">
          <select value={diet} onChange={(e) => setDiet(e.target.value as Diet)} className={FIELD}>
            {DIETS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </XpGroupBox>
        <XpGroupBox title="Geschlecht">
          <select value={sex} onChange={(e) => setSex(e.target.value as 'male' | 'female')} className={FIELD}>
            <option value="male">Männlich</option>
            <option value="female">Weiblich</option>
          </select>
        </XpGroupBox>
      </div>

      <XpGroupBox title="Körperdaten">
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className={LABEL} htmlFor="ob-age">Alter</label>
            <input id="ob-age" value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="ob-height">Größe (cm)</label>
            <input id="ob-height" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="numeric" className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="ob-weight">Gewicht (kg)</label>
            <input id="ob-weight" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" className={FIELD} />
          </div>
        </div>
      </XpGroupBox>

      <XpGroupBox title="Trainingstage pro Woche">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
        <button key={n} type="button" onClick={() => setTrainingDays(String(n))} className={optionChip(Number(trainingDays) === n)}>
              {n}
            </button>
          ))}
        </div>
      </XpGroupBox>

      {error && (
        <p role="alert" className="rounded-[12px] border border-[#ff9b92]/30 bg-[#331514]/80 px-2 py-1.5 text-[12px] text-[#ff9b92] shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
          {error}
        </p>
      )}

      <XpButton type="submit" variant="primary" className="w-full !py-2 text-[13px]">
        Wochenplan erstellen
      </XpButton>

      <p className="text-[10px] text-[#8bada7]">
        Die Berechnung ist eine Schätzung und ersetzt keine Ernährungsberatung.
      </p>
    </form>
  )
}
