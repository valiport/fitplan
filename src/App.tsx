// App-Einstieg: Liquid-Glass-Shell mit Glas-Taskbar. Der Planer läuft als
// Glasfenster (Planner.tsx), das Onboarding ebenfalls. Auf dem Handy bleibt
// alles einspaltig und kompakt.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import AuthGate from './components/AuthGate'
import { useAuthSession } from './hooks/useAuthSession'
import Onboarding from './components/Onboarding'
import Planner from './components/Planner'
import { XpButton, XpWindow } from './components/ui'
import { useCloudProfile } from './hooks/useCloudProfile'
import { usePro, type BillingInterval } from './hooks/usePro'
import { useEquipment } from './hooks/useEquipment'
import { useSyncedChecks } from './hooks/useSyncedChecks'
import { useWorkoutOverrides } from './hooks/useWorkoutOverrides'
import { useWeights } from './hooks/useWeights'
import { addDays, startOfWeek, toISODate } from './domain/dates'
import { buildWeekPlan } from './domain/weekPlan'
import { sportLabel } from './domain/training'
import type { Profile } from './domain/types'

/** Glas-Shell: weicher Blau-Gradient + Glas-Taskbar mit Uhr. */
function DesktopFrame({ windowTitle, children }: { windowTitle: string; children: ReactNode }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <main className="flex min-h-screen flex-col px-3 pb-16 pt-4 sm:px-6 sm:pt-8">
      <div className="flex flex-1 flex-col items-center justify-start gap-3">{children}</div>

      {/* Glas-Taskbar */}
      <div className="glass-taskbar">
        <span
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#5fe3d4] to-[#14806f] px-3 py-1 text-[12px] font-bold text-[#04231f] shadow-[0_2px_10px_rgba(20,150,135,0.4)]"
        >
          <span aria-hidden>💠</span> FitPlan
        </span>
        <div className="hidden min-w-0 flex-1 truncate text-[11px] text-[#a9c4be] sm:block">
          {windowTitle}
        </div>
        <div
          className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#d5e9e5]"
          aria-label="Uhrzeit"
        >
          {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </main>
  )
}

function PlannerScreen({ profile, userId, onReset, isPro, onUpgrade, onResetPro }: {
  profile: Profile
  userId: string
  onReset: () => void
  isPro: boolean
  onUpgrade: (plan: BillingInterval) => void
  onResetPro: () => void
}) {
  const [weekOffset, setWeekOffset] = useState(0) // 0 = diese Woche
  const [rerollsByWeek, setRerollsByWeek] = useState<Record<string, number>>({})
  const { equipment, toggle: toggleEquipment, error: equipmentError } = useEquipment(userId, profile.sport)

  const weekStart = useMemo(() => addDays(startOfWeek(), weekOffset * 7), [weekOffset])
  const weekStartISO = toISODate(weekStart)
  const [weekYear, weekMonth, weekDay] = weekStartISO.split('-').map(Number)
  const calendarWeekSeed = Math.floor(Date.UTC(weekYear, (weekMonth ?? 1) - 1, weekDay) / (7 * 24 * 60 * 60 * 1000))
  const rerolls = rerollsByWeek[weekStartISO] ?? 0
  const { checked, checkedByWeek, photoUrls, loading: checksLoading, error: syncError, busyMealIds, uploadProgress, queuedCount, toggleCheck, completeMealWithPhoto } = useSyncedChecks(userId, weekStartISO)
  const { overrides, changeHandler } = useWorkoutOverrides(profile.sport)
  const { entries: weightEntries, addWeight: addWeightEntry, error: weightError } = useWeights(userId)

  const plan = useMemo(
    () => buildWeekPlan(profile, weekStart, calendarWeekSeed + rerolls, overrides, isPro ? equipment : undefined),
    // weekStartISO deckt weekStart ab (useMemo-Dep als String stabil)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, weekStartISO, calendarWeekSeed, rerolls, overrides, equipment, isPro],
  )

  const onWeekShift = (delta: number) => {
    if (delta === 0) {
      setWeekOffset(0)
      return
    }
    setWeekOffset((w) => w + delta)
  }

  return (
    <DesktopFrame windowTitle={`FitPlan – ${sportLabel(profile.sport)}`}>
      <Planner
        profile={profile}
        plan={plan}
        weekStartISO={weekStartISO}
        checked={checked}
        onToggleCheck={toggleCheck}
        onCompleteMealWithPhoto={completeMealWithPhoto}
        photoUrls={photoUrls}
        syncLoading={checksLoading}
        busyMealIds={busyMealIds}
        uploadProgress={uploadProgress}
        queuedCount={queuedCount}
        syncError={syncError}
        checkedByWeek={checkedByWeek}
        weekOffset={weekOffset}
        onWeekShift={onWeekShift}
        isPro={isPro}
        onUpgrade={onUpgrade}
        onResetPro={onResetPro}
        onResetProfile={onReset}
        onReroll={() => setRerollsByWeek((previous) => ({
          ...previous,
          [weekStartISO]: (previous[weekStartISO] ?? 0) + 1,
        }))}
        equipment={equipment}
        equipmentError={equipmentError}
        weightEntries={weightEntries}
        weightError={weightError}
        onAddWeight={addWeightEntry}
        onToggleEquipment={toggleEquipment}
        workoutOverrides={overrides}
        onOverride={(dayIndex, main) => changeHandler(dayIndex, main)}
      />
    </DesktopFrame>
  )
}

function OnboardingScreen({ onDone }: { onDone: (p: Profile) => void }) {
  return (
    <DesktopFrame windowTitle="FitPlan – Willkommen">
      <XpWindow title="FitPlan – Willkommen" icon="🏋">
        <p className="mb-3 text-[12px] text-[#a9c4be]">
          Dein Wochenplan: Training + Ernährung, automatisch auf dein Ziel abgestimmt.
        </p>
        <Onboarding onDone={onDone} />
      </XpWindow>
    </DesktopFrame>
  )
}

function SignedInApp({ userId }: { userId: string }) {
  const { profile, loading, ready, error, save, clear, retry } = useCloudProfile(userId)
  const [savingProfile, setSavingProfile] = useState(false)
  const saveProfile = async (next: Profile) => {
    setSavingProfile(true)
    await save(next)
    setSavingProfile(false)
  }
  const { isPro, upgrade, reset } = usePro()
  const handleUpgrade = (plan: BillingInterval) => {
    void upgrade(plan).catch((err: unknown) => {
      console.error('Pro-Upgrade fehlgeschlagen:', err)
    })
  }

  if (loading) return <XpWindow title="Profil wird synchronisiert" icon="☁"><p className="text-[12px] text-[#a9c4be]">Bitte warten …</p></XpWindow>
  if (!ready) return <DesktopFrame windowTitle="FitPlan – Cloud-Synchronisierung">
    <XpWindow title="Profil-Synchronisierung fehlgeschlagen" icon="☁">
      <p role="alert" className="mb-2 text-[12px] text-[#ff9b92]">{error ?? 'Das Profil konnte nicht sicher aus der Cloud geladen werden.'}</p>
      <XpButton variant="primary" onClick={retry}>Erneut versuchen</XpButton>
    </XpWindow>
  </DesktopFrame>
  return <>
    {error && <p role="alert" className="max-w-md rounded-[14px] border border-[#ff9b92]/30 bg-[#331514]/80 p-2 text-[11px] text-[#ff9b92] shadow-[0_2px_10px_rgba(31,45,71,0.12)]">{error}</p>}
    {profile
      ? <PlannerScreen profile={profile} userId={userId} onReset={() => { void clear() }} isPro={isPro} onUpgrade={handleUpgrade} onResetPro={reset} />
      : savingProfile
        ? <XpWindow title="Profil wird synchronisiert" icon="☁"><p className="text-[12px] text-[#a9c4be]">Profil wird sicher gespeichert …</p></XpWindow>
        : <OnboardingScreen onDone={(next) => { void saveProfile(next) }} />}
  </>
}

export default function App() {
  const { session, setSession, loading } = useAuthSession()

  if (loading) {
    return <DesktopFrame windowTitle="FitPlan – Verbindung">
      <XpWindow title="FitPlan – Verbindung wird hergestellt" icon="☁">
        <p className="text-[12px] text-[#a9c4be]">Sichere Sitzung wird geladen …</p>
      </XpWindow>
    </DesktopFrame>
  }

  if (!session) return <DesktopFrame windowTitle="FitPlan – Anmeldung">
    <AuthGate session={null} onSession={setSession}>{null}</AuthGate>
  </DesktopFrame>

  return <AuthGate session={session} onSession={setSession}>
    <SignedInApp key={session.user.id} userId={session.user.id} />
  </AuthGate>
}
