import { useMemo, useState } from 'react'
import Onboarding from './components/Onboarding'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import ShoppingList from './components/ShoppingList'
import ProgressPanel from './components/ProgressPanel'
import Paywall from './components/Paywall'
import { useProfile } from './hooks/useProfile'
import { useWeekChecks } from './hooks/useWeekChecks'
import { useWeights } from './hooks/useWeights'
import { useWorkoutOverrides } from './hooks/useWorkoutOverrides'
import { usePro } from './hooks/usePro'
import { buildWeekPlan } from './domain/weekPlan'
import { startOfWeek, toISODate, addDays, WEEKDAY_LABELS, formatKcal } from './domain/dates'
import { sportLabel } from './domain/training'
import type { Profile } from './domain/types'

function Planner({ profile, onReset, isPro, onUpgrade, onResetPro }: {
  profile: Profile
  onReset: () => void
  isPro: boolean
  onUpgrade: () => void
  onResetPro: () => void
}) {
  const [weekOffset, setWeekOffset] = useState(0) // 0 = diese Woche
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = new Date().getDay()
    return (today + 6) % 7 // Mo=0..So=6
  })
  const [tab, setTab] = useState<'plan' | 'shopping' | 'progress'>('plan')
  const [rerolls, setRerolls] = useState(0)

  const weekStart = useMemo(() => {
    const base = startOfWeek()
    return addDays(base, weekOffset * 7)
  }, [weekOffset])

  const weekStartISO = toISODate(weekStart)
  const { overrides: workoutOverrides, changeHandler } = useWorkoutOverrides(profile.sport)

  const plan = useMemo(
    () => buildWeekPlan(profile, weekStart, rerolls, workoutOverrides),
    // rerolls = Seed für Rezept-Auswahl (Pro-Reroll); weekStart ändert sich über weekOffset
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, weekStartISO, rerolls, workoutOverrides],
  )
  const { checked, toggle } = useWeekChecks(weekStartISO)
  const { entries, addWeight } = useWeights()

  const day = plan.days[selectedDay]
  const dayDate = addDays(weekStart, selectedDay)

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      {/* Kopfzeile */}
      <div className="w-full">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">
            FitPlan · {sportLabel(profile.sport)}
          </h1>
          <div className="flex items-center gap-2">
            {isPro ? (
              <button
                onClick={onResetPro}
                title="Pro-Status zurücksetzen (Demo)"
                className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-medium text-cyan-300"
              >
                Pro
              </button>
            ) : (
              <button
                onClick={onUpgrade}
                className="rounded-full border border-cyan-500/50 px-3 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/10"
              >
                Pro holen
              </button>
            )}
            <button
              onClick={onReset}
              className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-400 transition hover:border-gray-400 hover:text-gray-200"
            >
              Profil
            </button>
          </div>
        </div>

        {/* Wochen-Navigation */}
        <div className="mt-2 flex items-center justify-between text-sm">
          <button
            onClick={() => { setWeekOffset((w) => w - 1); setRerolls((r) => r + 1) }}
            className="rounded-lg px-2 py-1 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
          >
            ← Vorherige
          </button>
          <span className="text-gray-400">
            KW ab {weekStartISO}
            {weekOffset !== 0 && (
              <button
                onClick={() => { setWeekOffset(0); setRerolls((r) => r + 1) }}
                className="ml-2 text-cyan-300 hover:underline"
              >
                (Heute)
              </button>
            )}
          </span>
          <button
            onClick={() => { setWeekOffset((w) => w + 1); setRerolls((r) => r + 1) }}
            className="rounded-lg px-2 py-1 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
          >
            Nächste →
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full gap-2">
        {([['plan', 'Plan'], ['shopping', 'Einkauf'], ['progress', 'Fortschritt']] as const).map(
          ([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={
                'flex-1 rounded-lg px-3 py-2 text-sm transition ' +
                (tab === value
                  ? 'bg-cyan-500 font-medium text-gray-950'
                  : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700')
              }
            >
              {label}
            </button>
          ),
        )}
      </div>

      {tab === 'plan' && (
        <>
          <WeekView plan={plan} selected={selectedDay} onSelect={setSelectedDay} />
          <div className="w-full text-center">
            <p className="text-sm text-gray-400">
              {WEEKDAY_LABELS[selectedDay]}, {dayDate.getDate()}.{dayDate.getMonth() + 1}. ·{' '}
              {formatKcal(day.kcal)} ·{' '}
              <span className={day.kind === 'hard' ? 'text-cyan-300' : day.kind === 'easy' ? 'text-teal-300' : 'text-gray-500'}>
                {day.kind === 'hard' ? 'Harter Tag' : day.kind === 'easy' ? 'Leichter Tag' : 'Ruhetag'}
              </span>
            </p>
          </div>
          <DayView
            day={day}
            dayIndex={selectedDay}
            checked={checked}
            onToggle={toggle}
            sport={profile.sport}
            override={workoutOverrides[selectedDay]}
            onOverride={(main) => changeHandler(selectedDay, main)}
          />
          {!isPro && (
            <button
              onClick={onUpgrade}
              className="w-full rounded-lg border border-dashed border-cyan-500/40 px-4 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/10"
            >
              Plan neu würfeln (Pro)
            </button>
          )}
          {isPro && (
            <button
              onClick={() => setRerolls((r) => r + 1)}
              className="w-full rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 transition hover:border-cyan-400 hover:text-cyan-300"
            >
              Plan neu würfeln
            </button>
          )}
        </>
      )}

      {tab === 'shopping' && <ShoppingList plan={plan} checked={checked} />}

      {tab === 'progress' && (
        <ProgressPanel profile={profile} entries={entries} onAdd={addWeight} isPro={isPro} />
      )}

      {!isPro && <Paywall onUpgrade={onUpgrade} />}
    </div>
  )
}

export default function App() {
  const { profile, save, clear } = useProfile()
  const { isPro, upgrade, reset } = usePro()

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-6 py-12 text-gray-100">
        <h1 className="text-3xl font-bold tracking-tight">FitPlan</h1>
        <p className="max-w-md text-center text-gray-400">
          Dein Wochenplan: Training + Ernährung, automatisch auf dein Ziel abgestimmt.
        </p>
        <Onboarding onDone={save} />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-gray-950 px-6 py-12 text-gray-100">
      <Planner
        profile={profile}
        onReset={clear}
        isPro={isPro}
        onUpgrade={upgrade}
        onResetPro={reset}
      />
    </main>
  )
}
