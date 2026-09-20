// Frei gewählte Trainingseinheiten pro Wochentag, pro Sportart gespeichert.

import { useCallback, useEffect, useState } from 'react'
import { loadJson, removeKey, saveJson } from '../domain/storage'
import type { Sport, WorkoutOverrides } from '../domain/types'

const PREFIX = 'fitplanner.workout-override.'

function parseOverrides(raw: unknown): WorkoutOverrides | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null

  const overrides: WorkoutOverrides = {}
  for (const [day, workout] of Object.entries(raw as Record<string, unknown>)) {
    const dayIndex = Number(day)
    if (Number.isInteger(dayIndex) && dayIndex >= 0 && dayIndex <= 6 && typeof workout === 'string') {
      overrides[dayIndex] = workout
    }
  }
  return overrides
}

export function useWorkoutOverrides(sport: Sport) {
  const key = PREFIX + sport
  const [overrides, setOverrides] = useState<WorkoutOverrides>(
    () => loadJson(key, parseOverrides) ?? {},
  )

  // Sportwechsel lädt dessen eigenen Scope; die Auswahl anderer Sportarten bleibt erhalten.
  useEffect(() => {
    setOverrides(loadJson(key, parseOverrides) ?? {})
  }, [key])

  const changeHandler = useCallback(
    (dayIndex: number, workout: string | null) => {
      setOverrides((previous) => {
        const next = { ...previous }
        if (workout === null) delete next[dayIndex]
        else next[dayIndex] = workout

        if (Object.keys(next).length === 0) removeKey(key)
        else saveJson(key, next)
        return next
      })
    },
    [key],
  )

  return { overrides, signature: key, changeHandler }
}
