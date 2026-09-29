// Tagesplan: Trainingseinheit mit Guide + 4 Mahlzeiten mit Mengen und
// Kochanleitung. Mahlzeiten sind nur mit Foto abhakbar; das Foto erscheint
// als kleine Vorschau (Klick = Lupe) und wird auf plausible Aufnahmezeit
// geprüft (Hinweis, kein Blocker). Optik: Liquid Glass.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { DayPlan, MealSlot, Sport, WorkoutKey } from '../domain/types'
import { workoutOptionsFor } from '../domain/training'
import { formatKcal } from '../domain/dates'

const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  snack: 'Snack',
  dinner: 'Abend',
}

const KIND_LABEL: Record<DayPlan['kind'], string> = {
  hard: 'Harter Tag',
  easy: 'Leichter Tag',
  rest: 'Ruhetag',
}

/** Aufklappbarer Bereich. */
function Disclosure({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="mt-1.5">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1 text-[12px] font-bold text-[#5fe3d4] hover:underline"
      >
        <span aria-hidden className={'inline-block text-[9px] transition-transform ' + (open ? 'rotate-90' : '')}>
          ▶
        </span>
        {title}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}

/** Erwartetes Aufnahmezeit-Fenster je Mahlzeit (lokale Stunden, Endzahl exklusiv). */
const SLOT_WINDOWS: Record<MealSlot, [number, number]> = {
  breakfast: [4, 11],
  lunch: [10, 15],
  snack: [12, 19],
  dinner: [16, 26], // 16–02 Uhr (über Mitternacht)
}

const hourInWindow = (hour: number, [start, end]: [number, number]) =>
  end > 24 ? hour >= start || hour < end - 24 : hour >= start && hour < end

export type PhotoTimeWarning = { code: 'future' | 'too-old' | 'wrong-slot'; message: string }

/**
 * Plausibilitätsprüfung des Fotos anhand des Datei-Zeitstempels
 * (Aufnahmezeit bei Kamera-Uploads). Gibt eine Warnung zurück, wenn die
 * Zeit nicht zur Mahlzeit passt — bewusst nur ein Hinweis, kein Blocker,
 * da manche Geräte/Browser keine verlässlichen Zeitdaten liefern.
 */
export function checkPhotoTime(file: File, slot: MealSlot, now = new Date()): PhotoTimeWarning | null {
  const taken = new Date(file.lastModified)
  if (Number.isNaN(taken.getTime())) return null
  const diffMs = now.getTime() - taken.getTime()
  if (diffMs < -5 * 60_000) {
    return { code: 'future', message: 'Der Zeitstempel des Fotos liegt in der Zukunft.' }
  }
  if (diffMs > 24 * 60 * 60_000) {
    return { code: 'too-old', message: 'Das Foto ist älter als 24 Stunden.' }
  }
  const hour = taken.getHours()
  if (!hourInWindow(hour, SLOT_WINDOWS[slot])) {
    const time = taken.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    return { code: 'wrong-slot', message: `Aufnahme um ${time} Uhr passt nicht typischerweise zu dieser Mahlzeit (${MEAL_LABEL[slot]}).` }
  }
  return null
}

/** Vollbild-Zoom für ein Mahlzeitenfoto (Lightbox mit Glas-Rahmen). */
function PhotoLightbox({ src, caption, onClose }: { src: string; caption: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      // Immer auf Standard zurücksetzen: Ein Restore des vorherigen Werts
      // würde 'hidden' einfrieren, wenn der Effekt bei offenem Dialog
      // durch ein Re-Render erneut läuft.
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="glass-lightbox-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto: ${caption}`}
      onClick={onClose}
    >
      <div
        className="glass-panel glass-zoom-in relative max-h-[86vh] w-full max-w-lg overflow-hidden p-2"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fotoansicht schließen"
          className="glass-titlebtn glass-titlebtn-danger absolute right-3 top-3 z-10"
        >
          ✕
        </button>
        <img src={src} alt={`Foto: ${caption}`} className="max-h-[70vh] w-full rounded-[14px] object-contain" />
        <p className="pt-2 text-center text-[12px] font-semibold text-[#d5e9e5]">{caption}</p>
      </div>
    </div>
  )
}

export default function DayView({
  day,
  dayIndex,
  checked,
  onToggle,
  onCompleteMealWithPhoto,
  photoUrls,
  busyMealIds,
  uploadProgress,
  syncLoading,
  sport,
  override,
  onOverride,
  feasibleOptions,
}: {
  day: DayPlan
  dayIndex: number
  checked: Set<string>
  onToggle: (id: string) => Promise<void>
  onCompleteMealWithPhoto: (id: string, file: File) => Promise<void>
  photoUrls: Record<string, string>
  busyMealIds: Set<string>
  /** Echter Upload-Fortschritt in % je Check (0–100), während er läuft. */
  uploadProgress: Record<string, number>
  syncLoading: boolean
  sport: Sport
  override?: string
  onOverride: (workout: string | null) => void
  /** Vorgefilterte Optionen (Equipment); fehlt sie, wird die Bibliothek genutzt. */
  feasibleOptions?: { key: WorkoutKey; label: string }[]
}) {
  const checkId = (what: string, i: number) => `d${dayIndex}-${what}-${i}`
  const done = (id: string) => checked.has(id)
  const options = feasibleOptions ?? workoutOptionsFor(sport, day.kind)
  const selectedWorkout =
    override !== undefined && options.some((o) => o.label === override) ? override : 'auto'

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [guideOpen, setGuideOpen] = useState(false)
  const [mealActionError, setMealActionError] = useState<{ id: string; message: string } | null>(null)
  const [openMeals, setOpenMeals] = useState<Set<number>>(new Set())
  // Foto, dessen Zeit unplausibel wirkt — wartet auf Bestätigung oder Abbruch.
  const [pendingPhoto, setPendingPhoto] = useState<{ id: string; file: File; warning: PhotoTimeWarning } | null>(null)
  // Aktuell im Zoom geöffnetes Foto (check_id) + dessen Alt-Text.
  const [zoomedPhoto, setZoomedPhoto] = useState<{ id: string; caption: string } | null>(null)

  const startUpload = (id: string, file: File) => {
    setMealActionError(null)
    void onCompleteMealWithPhoto(id, file).catch((error: unknown) => {
      setMealActionError({ id, message: error instanceof Error ? error.message : 'Foto konnte nicht hochgeladen werden.' })
    })
  }

  const handleFilePicked = (id: string, slot: MealSlot, file: File | undefined) => {
    if (!file) return
    const warning = checkPhotoTime(file, slot)
    if (warning) setPendingPhoto({ id, file, warning })
    else {
      // Eine noch offene Warnung für dieselbe Mahlzeit verfällt, sobald
      // ein sauberes Foto hochgeladen wird.
      setPendingPhoto((previous) => (previous?.id === id ? null : previous))
      startUpload(id, file)
    }
  }

  const toggleMeal = (i: number) => {
    setOpenMeals((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const checkChip = (isDone: boolean, label: string) => (
    <button
      onClick={() => void onToggle(checkId('workout', 0)).catch(() => undefined)}
      aria-pressed={isDone}
      className={'glass-chip shrink-0 ' + (isDone ? 'glass-chip-active' : '')}
    >
      {isDone ? '✓ erledigt' : label}
    </button>
  )

  return (
    <div className="flex flex-col gap-2 text-left">
      {/* Training */}
      <div className="glass-inset">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#5fe3d4]">
            {KIND_LABEL[day.kind]} · Training
          </span>
          {checkChip(done(checkId('workout', 0)), 'Training abhaken')}
        </div>
        <p className="mt-1 text-[13px] font-bold text-[#eaf6f3]">{day.workout}</p>
        {day.workoutGuide && (
          <Disclosure title="So geht's" open={guideOpen} onToggle={() => setGuideOpen((v) => !v)}>
            <div className="glass-inset">
              <p className="text-[12px] text-[#a9c4be]">{day.workoutGuide.summary}</p>
              <p className="mt-1 text-[11px] text-[#8bada7]">
                <span className="font-bold text-[#a9c4be]">Dauer:</span> {day.workoutGuide.duration} ·{' '}
                <span className="font-bold text-[#a9c4be]">Intensität:</span> {day.workoutGuide.intensity}
              </p>
              <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5fe3d4]">So geht's</p>
              <ol className="mt-0.5 list-inside list-decimal space-y-0.5 text-[12px] text-[#dcefec]">
                {day.workoutGuide.howTo.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5fe3d4]">Tipps</p>
              <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-[12px] text-[#9fb9b4]">
                {day.workoutGuide.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          </Disclosure>
        )}
        <label className="mt-1.5 block text-[11px] text-[#8bada7]" htmlFor={`workout-choice-${dayIndex}`}>
          Einheit auswählen
        </label>
        <select
          id={`workout-choice-${dayIndex}`}
          value={selectedWorkout}
          onChange={(event) => onOverride(event.target.value === 'auto' ? null : event.target.value)}
          className="glass-select mt-0.5 !py-1.5 text-[12px]"
        >
          <option value="auto">Auto (Rotation – keine Wiederholung in der Woche)</option>
          {options.map((option) => (
            // Label als Key: Keys müssen pro Liste eindeutig sein — Ruhetage
            // teilen sich denselben WorkoutKey, was React sonst verwirrt.
            <option key={option.label} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Mahlzeiten */}
      {day.meals.map((meal, i) => {
        const id = checkId('meal', i)
        const completed = done(id)
        const uploading = busyMealIds.has(id)
        const progress = uploadProgress[id]
        const mealOpen = openMeals.has(i)
        const photoUrl = photoUrls[id]
        return (
          <div key={i} className="glass-inset">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#5fe3d4]">
                {MEAL_LABEL[meal.slot]}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] tabular-nums text-[#8bada7]">{formatKcal(meal.kcal)}</span>
                <button
                  type="button"
                  disabled={syncLoading || uploading || busyMealIds.size > 0}
                  onClick={() => fileInputRefs.current[id]?.click()}
                  className="glass-btn shrink-0 !px-2.5 !py-1 !text-[11px] disabled:opacity-50"
                >
                  {uploading ? `Foto lädt … ${progress !== undefined ? `${progress}%` : ''}` : completed ? '📷 Foto ändern' : '📷 Foto & abhaken'}
                </button>
                {completed && (
                  <button
                    type="button"
                    disabled={syncLoading || uploading || busyMealIds.size > 0}
                    onClick={() => void onToggle(id).catch(() => undefined)}
                    aria-pressed
                    className="glass-btn glass-btn-primary shrink-0 !px-2.5 !py-1 !text-[11px] disabled:opacity-50"
                  >
                    ✓ Erledigt
                  </button>
                )}
                <input
                  ref={(node) => { fileInputRefs.current[id] = node }}
                  id={`meal-photo-${dayIndex}-${i}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  aria-label={`Foto für ${MEAL_LABEL[meal.slot]} auswählen oder aufnehmen`}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    handleFilePicked(id, meal.slot, file)
                  }}
                />
              </div>
            </div>
            <p className="mt-0.5 text-[13px] font-bold text-[#eaf6f3]">{meal.name}</p>
            {uploading && (
              <div className="glass-progress mt-1 !h-2" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`Upload-Fortschritt für ${MEAL_LABEL[meal.slot]}`}>
                <div className="glass-progress-fill" style={{ width: `${progress ?? 0}%` }} />
              </div>
            )}
            {mealActionError?.id === id && (
              <p role="alert" className="mt-1 rounded-[10px] border border-[#ff9b92]/30 bg-[#331514]/80 px-2 py-1 text-[11px] text-[#ff9b92]">
                {mealActionError.message}
              </p>
            )}
            {pendingPhoto?.id === id && (
              <div role="alert" className="mt-1 rounded-[12px] border border-[#ffcf7e]/30 bg-[#33270f]/85 p-2 text-[11px] text-[#ffcf7e] shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                <p className="font-bold">⏱ Zeit-Check: {pendingPhoto.warning.message}</p>
                <p className="mt-0.5 text-[10px] text-[#eab86a]">
                  Manche Geräte entfernen Zeitdaten — du kannst das Foto trotzdem verwenden.
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    type="button"
                    className="glass-btn glass-btn-primary !px-2.5 !py-1 !text-[11px]"
                    onClick={() => {
                      const pending = pendingPhoto
                      setPendingPhoto(null)
                      if (pending) startUpload(pending.id, pending.file)
                    }}
                  >
                    Trotzdem verwenden
                  </button>
                  <button
                    type="button"
                    className="glass-btn !px-2.5 !py-1 !text-[11px]"
                    onClick={() => setPendingPhoto(null)}
                  >
                    Anderes Foto wählen
                  </button>
                </div>
              </div>
            )}
            {completed && photoUrl && (
              <button
                type="button"
                onClick={() => setZoomedPhoto({ id, caption: meal.name })}
                aria-label={`Foto von ${meal.name} vergrößern`}
                className="group mt-1.5 block w-fit rounded-[14px] border border-white/15 bg-white/10 p-1 shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition hover:shadow-[0_4px_16px_rgba(20,150,135,0.35)]"
              >
                <img
                  src={photoUrl}
                  alt={`Foto: ${meal.name}`}
                  loading="lazy"
                  className="h-24 w-32 rounded-[10px] object-cover"
                />
                <span className="mt-0.5 block text-center text-[10px] font-semibold text-[#5fe3d4] group-hover:underline">
                  🔍 Vergrößern
                </span>
              </button>
            )}
            {completed && !photoUrl && (
              <p className="mt-1 text-[10px] text-[#8bada7]">Foto wird geladen oder ist offline nicht verfügbar.</p>
            )}
            <ul className="mt-0.5 text-[12px] text-[#dcefec]">
              {meal.items.map((item, j) => (
                <li key={j}>
                  {item.name}: {item.grams} {item.unit}
                </li>
              ))}
            </ul>
            {meal.steps.length > 0 && (
              <Disclosure title="Kochanleitung" open={mealOpen} onToggle={() => toggleMeal(i)}>
                <div className="glass-inset">
                  <ol className="list-inside list-decimal space-y-0.5 text-[12px] text-[#dcefec]">
                    {meal.steps.map((step, j) => (
                      <li key={j}>{step}</li>
                    ))}
                  </ol>
                </div>
              </Disclosure>
            )}
          </div>
        )
      })}

      {zoomedPhoto && photoUrls[zoomedPhoto.id] && (
        <PhotoLightbox
          src={photoUrls[zoomedPhoto.id]}
          caption={zoomedPhoto.caption}
          onClose={() => setZoomedPhoto(null)}
        />
      )}
    </div>
  )
}
