// Abgehakte Punkte pro Woche: Key enthält den Wochenstart, damit jede Woche
// ein eigener, frischer Satz Checks existiert.

import { useCallback, useEffect, useState } from 'react'
import { loadJson, saveJson } from '../domain/storage'

const PREFIX = 'fitplanner.checks.'

function parseChecks(raw: unknown): Set<string> | null {
  if (!Array.isArray(raw)) return null
  if (!raw.every((x) => typeof x === 'string')) return null
  return new Set(raw as string[])
}

export function useWeekChecks(weekStart: string) {
  const key = PREFIX + weekStart
  const [checked, setChecked] = useState<Set<string>>(
    () => loadJson(key, parseChecks) ?? new Set(),
  )

  // Wochenwechsel: useState-Initialisierung läuft nur beim Mount — ohne diesen
  // Effekt bleiben die Checks der Vorwoche im State und würden in den neuen
  // Wochen-Key zurückgeschrieben.
  useEffect(() => {
    setChecked(loadJson(key, parseChecks) ?? new Set())
  }, [key])

  const toggle = useCallback(
    (id: string) => {
      setChecked((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        saveJson(key, [...next])
        return next
      })
    },
    [key],
  )

  return { checked, toggle }
}
