// Gewichts-Verlauf: ein Eintrag pro Tag (gleicher Tag ersetzt), neueste zuerst.

import { useCallback, useState } from 'react'
import { loadJson, saveJson } from '../domain/storage'
import { toISODate } from '../domain/dates'
import type { WeightEntry } from '../domain/types'

const KEY = 'fitplanner.weights.v1'

function parseWeights(raw: unknown): WeightEntry[] | null {
  if (!Array.isArray(raw)) return null
  const out: WeightEntry[] = []
  for (const e of raw) {
    if (typeof e !== 'object' || e === null) continue
    const v = e as Record<string, unknown>
    if (typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) continue
    if (typeof v.kg !== 'number' || !Number.isFinite(v.kg) || v.kg < 30 || v.kg > 300) continue
    out.push({ date: v.date, kg: v.kg })
  }
  return out
}

export function useWeights() {
  const [entries, setEntries] = useState<WeightEntry[]>(() => loadJson(KEY, parseWeights) ?? [])

  const addWeight = useCallback((kg: number) => {
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) return false
    const date = toISODate(new Date())
    setEntries((prev) => {
      const next = [{ date, kg }, ...prev.filter((e) => e.date !== date)]
      saveJson(KEY, next)
      return next
    })
    return true
  }, [])

  return { entries, addWeight }
}
