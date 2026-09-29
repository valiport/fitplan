// Planner-Fenster: Wochen-Navigation, Tab-Leiste (Plan/Einkauf/Fortschritt),
// Streak-Anzeige, Tages-Tracker und Geräte-Dialog (Pro). Liquid-Glass-Optik,
// alles auf Handy-Breite ausgelegt.

import { useMemo, useState } from 'react'
import WeekView from './WeekView'
import DayView from './DayView'
import ShoppingList from './ShoppingList'
import ProgressPanel from './ProgressPanel'
import Paywall from './Paywall'
import { XpButton, XpGroupBox, XpProgress, XpTitleBar, XpTitleButton } from './ui'
import { addDays, formatKcal, WEEKDAY_LABELS } from '../domain/dates'
import { sportLabel } from '../domain/training'
import { computeStreak, dayProgress } from '../hooks/useStreak'
import { feasibleOptions as filterFeasible } from '../domain/equipment'
import { EQUIPMENT_CATALOG } from '../domain/equipment'
import type { Equipment, EquipmentSet, Profile, WeekPlan, WeightEntry } from '../domain/types'

/** Pro-Dialog: Geräte-Auswahl, nach der der Plan die Übungen anpasst. */
function EquipmentDialog({ owned, onToggle, onClose }: {
  owned: EquipmentSet
  onToggle: (id: Equipment) => void
  onClose: () => void
}) {
  return (
    <div className="glass-lightbox-backdrop" onClick={onClose}>
      <div
        className="glass-panel glass-zoom-in w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <XpTitleBar
          title="Meine Geräte (Pro)"
          icon="🏋"
          actions={<XpTitleButton label="Schließen" danger onClick={onClose} />}
        />
        <div className="p-2">
          <p className="mb-2 text-[12px] text-[#a9c4be]">
            Wähle, was du hast — der Plan schlägt dir nur passende Einheiten vor.
            Studio deckt Hantel, Bank und Reck ab.
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EQUIPMENT_CATALOG.map((eq) => {
              const active = owned.includes(eq.id)
              return (
                <button
                  key={eq.id}
                  onClick={() => onToggle(eq.id)}
                  aria-pressed={active}
                  className={
                    'flex items-center gap-1.5 rounded-[12px] border px-2 py-1.5 text-left text-[12px] transition ' +
                    (active
                      ? 'border-white/50 bg-gradient-to-b from-[#5fe3d4] to-[#14806f] font-bold text-[#04231f] shadow-[0_2px_10px_rgba(20,150,135,0.3)]'
                      : 'border-white/15 bg-white/10 text-[#dcefec] hover:bg-white/20')
                  }
                >
                  <span
                    className={
                      'flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border text-[10px] leading-none ' +
                      (active ? 'border-white/70 bg-white text-[#14806f]' : 'border-white/40 bg-white/10 text-transparent')
                    }
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate">{eq.label}</span>
                    <span className="block truncate text-[10px] font-normal text-[#8b9d99]">{eq.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex justify-end">
            <XpButton variant="primary" onClick={onClose}>
              Fertig
            </XpButton>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Streak-Widget als Glass-Karte. */
function StreakWidget({ streak }: { streak: number }) {
  return (
    <div className="flex items-center gap-2 rounded-[14px] border border-[#ffcf7e]/30 bg-gradient-to-b from-[#3a2c12]/90 to-[#291f0c]/75 px-2 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
      <span aria-hidden className="text-[16px]">🔥</span>
      <span className="text-[12px] font-bold text-[#ffcf7e]">
        {streak === 0
          ? 'Noch kein Streak – starte heute!'
          : streak === 1
            ? '1 Tag Streak'
            : `${streak} Tage Streak`}
      </span>
    </div>
  )
}

export default function Planner({
  profile,
  plan,
  weekStartISO,
  checked,
  onToggleCheck,
  onCompleteMealWithPhoto,
  photoUrls,
  syncLoading,
  busyMealIds,
  uploadProgress,
  queuedCount,
  syncError,
  checkedByWeek,
  weekOffset,
  onWeekShift,
  isPro,
  onUpgrade,
  onResetPro,
  onResetProfile,
  onReroll,
  equipment,
  onToggleEquipment,
  equipmentError,
  weightEntries,
  weightError,
  onAddWeight,
  workoutOverrides,
  onOverride,
}: {
  profile: Profile
  plan: WeekPlan
  weekStartISO: string
  checked: Set<string>
  onToggleCheck: (id: string) => Promise<void>
  onCompleteMealWithPhoto: (id: string, file: File) => Promise<void>
  photoUrls: Record<string, string>
  syncLoading: boolean
  busyMealIds: Set<string>
  uploadProgress: Record<string, number>
  queuedCount: number
  syncError: string | null
  checkedByWeek: Record<string, Set<string>>
  weekOffset: number
  onWeekShift: (delta: number | 0) => void
  isPro: boolean
  onUpgrade: () => void
  onResetPro: () => void
  onResetProfile: () => void
  onReroll: () => void
  equipment: EquipmentSet
  onToggleEquipment: (id: Equipment) => void
  equipmentError: string | null
  weightEntries: WeightEntry[]
  weightError: string | null
  onAddWeight: (kg: number) => boolean
  workoutOverrides: Record<number, string>
  onOverride: (dayIndex: number, workout: string | null) => void
}) {
  const [tab, setTab] = useState<'plan' | 'shopping' | 'progress'>('plan')
  const [selectedDay, setSelectedDay] = useState(() => {
    const t = new Date().getDay()
    return (t + 6) % 7 // Mo=0..So=6
  })
  const [showEquipment, setShowEquipment] = useState(false)

  const weekStart = useMemo(() => {
    const [y, m, d] = weekStartISO.split('-').map(Number)
    return new Date(y, (m ?? 1) - 1, d ?? 1)
  }, [weekStartISO])

  const day = plan.days[selectedDay]
  const dayDate = addDays(weekStart, selectedDay)
  const current = dayProgress(selectedDay, day, checked)
  // Equipment-gefilterte Einheiten für den gewählten Tag (Pro); ohne Ausrüstungs-Angabe = volle Bibliothek.
  const dayWorkoutOptions = filterFeasible(profile.sport, day.kind, isPro ? equipment : undefined)

  const streakInfo = useMemo(
    () => computeStreak(plan.days, (week) => checkedByWeek[week] ?? new Set()),
    [plan.days, checkedByWeek],
  )

  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      {/* Hauptfenster */}
      <div className="glass-panel">
        <XpTitleBar
          title={`FitPlan – ${sportLabel(profile.sport)}`}
          icon="🏋"
          actions={
            <>
              <XpTitleButton
                label={isPro ? 'Meine Geräte' : 'Geräte (Pro-Feature)'}
                onClick={() => (isPro ? setShowEquipment(true) : onUpgrade())}
              />
              {isPro ? (
                <XpTitleButton label="Pro-Status zurücksetzen (Demo)" onClick={onResetPro} />
              ) : (
                <XpTitleButton label="Pro holen" onClick={onUpgrade} />
              )}
              <XpTitleButton label="Profil neu einrichten" danger onClick={onResetProfile} />
            </>
          }
        />
        <div className="p-2">
          {syncError && <p role="alert" className="mb-2 rounded-[12px] border border-[#ff9b92]/30 bg-[#331514]/80 p-2 text-[11px] text-[#ff9b92]">Sync-Fehler: {syncError}</p>}
          {syncLoading && <p role="status" className="mb-2 text-[11px] text-[#8bada7]">Cloud-Checks werden synchronisiert …</p>}
          {queuedCount > 0 && (
            <p role="status" className="mb-2 rounded-[12px] border border-[#ffcf7e]/30 bg-[#33270f]/85 p-2 text-[11px] text-[#ffcf7e] shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
              ⏳ {queuedCount === 1 ? '1 Foto wartet' : `${queuedCount} Fotos warten`} in der Warteschlange und werden automatisch hochgeladen, sobald du wieder online bist.
            </p>
          )}
          {equipmentError && <p role="alert" className="mb-2 rounded-[12px] border border-[#ff9b92]/30 bg-[#331514]/80 p-2 text-[11px] text-[#ff9b92]">{equipmentError}</p>}
          {weightError && <p role="alert" className="mb-2 rounded-[12px] border border-[#ff9b92]/30 bg-[#331514]/80 p-2 text-[11px] text-[#ff9b92]">{weightError}</p>}
          {/* Wochen-Navigation */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <XpButton onClick={() => onWeekShift(-1)}>← Zurück</XpButton>
            <span className="text-[12px] font-bold text-[#5fe3d4]">
              KW ab {weekStartISO}
              {weekOffset !== 0 && (
                <button onClick={() => onWeekShift(0)} className="ml-1 underline">
                  (Heute)
                </button>
              )}
            </span>
            <XpButton onClick={() => onWeekShift(1)}>Weiter →</XpButton>
          </div>

          {/* Tab-Leiste */}
          <div className="mb-2 flex gap-1">
            {([['plan', 'Plan'], ['shopping', 'Einkauf'], ['progress', 'Fortschritt']] as const).map(
              ([value, label]) => (
                <XpButton
                  key={value}
                  variant={tab === value ? 'primary' : 'default'}
                  className="flex-1"
                  onClick={() => setTab(value)}
                >
                  {label}
                </XpButton>
              ),
            )}
          </div>

          {tab === 'plan' && (
            <>
              <WeekView plan={plan} selected={selectedDay} onSelect={setSelectedDay} />

              {/* Tages-Tracker */}
              <XpGroupBox
                title={`${WEEKDAY_LABELS[selectedDay]}, ${dayDate.getDate()}.${dayDate.getMonth() + 1}.`}
              >
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#a9c4be]">
                  <span>
                    {formatKcal(day.kcal)} ·{' '}
                    <span
                      className={
                        day.kind === 'hard'
                          ? 'font-bold text-[#ff8a7a]'
                          : day.kind === 'easy'
                            ? 'font-bold text-[#5fe3d4]'
                            : 'text-[#8bada7]'
                      }
                    >
                      {day.kind === 'hard' ? 'Harter Tag' : day.kind === 'easy' ? 'Leichter Tag' : 'Ruhetag'}
                    </span>
                  </span>
                  <span className="font-bold">
                    {current.done}/{current.total} erledigt
                  </span>
                </div>
                <XpProgress percent={(current.done / Math.max(1, current.total)) * 100} />
                {current.complete && (
                  <p className="mt-1 text-[12px] font-bold text-[#5fd9a6]">✓ Alles geschafft – weiter so!</p>
                )}
              </XpGroupBox>

              <StreakWidget streak={streakInfo.streak} />

              <div className="mt-2">
                <DayView
                  day={day}
                  dayIndex={selectedDay}
                  checked={checked}
                  onToggle={onToggleCheck}
                  onCompleteMealWithPhoto={onCompleteMealWithPhoto}
                  photoUrls={photoUrls}
                  busyMealIds={busyMealIds}
                  uploadProgress={uploadProgress}
                  syncLoading={syncLoading}
                  sport={profile.sport}
                  override={workoutOverrides[selectedDay]}
                  onOverride={(main) => onOverride(selectedDay, main)}
                  feasibleOptions={dayWorkoutOptions}
                />
              </div>

              {isPro ? (
                <XpButton className="mt-2 w-full" onClick={onReroll}>
                  🎲 Plan neu würfeln
                </XpButton>
              ) : (
                <XpButton className="mt-2 w-full" variant="primary" onClick={onUpgrade}>
                  🎲 Plan neu würfeln – Pro freischalten
                </XpButton>
              )}
            </>
          )}

          {tab === 'shopping' && <ShoppingList plan={plan} checked={checked} />}

          {tab === 'progress' && (
            <ProgressPanel profile={profile} entries={weightEntries} onAdd={onAddWeight} isPro={isPro} />
          )}
        </div>
      </div>

      {showEquipment && (
        <EquipmentDialog owned={equipment} onToggle={onToggleEquipment} onClose={() => setShowEquipment(false)} />
      )}

      {!isPro && <Paywall onUpgrade={onUpgrade} />}
    </div>
  )
}
