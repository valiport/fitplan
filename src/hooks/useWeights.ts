// Gewichts-Verlauf: ein Eintrag pro Tag (gleicher Tag ersetzt), neueste zuerst.
// Cloud-synchronisiert (Tabelle weight_entries): Cloud ist führend,
// localStorage dient als sofortiger Cache und Offline-Fallback. Eigene
// Einträge laufen optimistisch lokal und werden dann hochgeschrieben.

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadJson, saveJson } from '../domain/storage'
import { supabase } from '../lib/supabase'
import { toISODate } from '../domain/dates'
import type { WeightEntry } from '../domain/types'

const KEY = 'fitplanner.weights.v1'
const cacheKey = (userId: string) => `${KEY}.${userId}`
const IMPORT_MARKER = 'fitplanner.cloud-weights-import.v1.'

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
  // Neueste zuerst, ein Eintrag pro Tag.
  const byDate = new Map<string, number>()
  for (const e of out) byDate.set(e.date, e.kg)
  return [...byDate.entries()]
    .map(([date, kg]) => ({ date, kg }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function useWeights(userId: string) {
  const [entries, setEntries] = useState<WeightEntry[]>(() => loadJson(cacheKey(userId), parseWeights) ?? [])
  const entriesRef = useRef(entries)
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((next: WeightEntry[]) => {
    entriesRef.current = next
    setEntries(next)
    saveJson(cacheKey(userId), next)
  }, [userId])

  // Lokal geänderte Tage: Fetch/Realtime darf sie nicht überschreiben.
  const dirtyDates = useRef(new Set<string>())
  // Realtime-Überlagerung pro Tag; null = in der Cloud gelöscht.
  const realtimeByDate = useRef(new Map<string, number | null>())

  // Einen (ggf. während eines Uploads eingetroffenen) Remote-Wert anwenden.
  const applyRealtimeDate = useCallback((date: string) => {
    const kg = realtimeByDate.current.get(date)
    if (kg === undefined) return
    const base = entriesRef.current.filter((e) => e.date !== date)
    const next = kg === null ? base : [...base, { date, kg }]
    apply(next.sort((a, b) => (a.date < b.date ? 1 : -1)))
  }, [apply])

  const persist = useCallback(async (date: string, kg: number) => {
    if (!supabase) return
    dirtyDates.current.add(date)
    realtimeByDate.current.delete(date) // eigener Upload ist ab jetzt führend
    try {
      const { error: upsertError } = await supabase
        .from('weight_entries')
        .upsert({ user_id: userId, entry_date: date, kg, updated_at: new Date().toISOString() }, {
          onConflict: 'user_id,entry_date',
        })
      if (upsertError) throw upsertError
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error
        ? `Gewicht konnte nicht synchronisiert werden: ${cause.message}`
        : 'Gewichts-Synchronisierung fehlgeschlagen.')
    } finally {
      dirtyDates.current.delete(date)
      // Während des Uploads eingetroffene Remote-Werte jetzt anwenden.
      applyRealtimeDate(date)
    }
  }, [userId, applyRealtimeDate])

  // Cloud laden + Live-Synchronisierung + Migration alter Lokaldaten.
  useEffect(() => {
    if (!supabase) return
    let active = true
    realtimeByDate.current = new Map()

    const applyMerged = (fetched: WeightEntry[]) => {
      const byDate = new Map<string, number>()
      for (const e of fetched) byDate.set(e.date, e.kg)
      for (const [date, kg] of realtimeByDate.current) {
        if (kg === null) byDate.delete(date)
        else byDate.set(date, kg)
      }
      for (const date of dirtyDates.current) {
        const local = entriesRef.current.find((e) => e.date === date)
        if (local) byDate.set(date, local.kg)
        else byDate.delete(date)
      }
      apply([...byDate.entries()]
        .map(([date, kg]) => ({ date, kg }))
        .sort((a, b) => (a.date < b.date ? 1 : -1)))
    }

    const readAll = async (): Promise<WeightEntry[]> => {
      const { data, error: queryError } = await supabase!
        .from('weight_entries')
        .select('entry_date,kg')
        .eq('user_id', userId)
        .order('entry_date', { ascending: false })
      if (queryError) throw queryError
      return parseWeights(((data ?? []) as { entry_date: string; kg: number }[])
        .map((row) => ({ date: row.entry_date, kg: row.kg }))) ?? []
    }

    const migrateLegacy = async () => {
      if (localStorage.getItem(IMPORT_MARKER + userId) === 'done') return
      const { data, error: queryError } = await supabase!
        .from('weight_entries')
        .select('entry_date')
        .eq('user_id', userId)
      if (queryError) throw queryError
      const existing = new Set(((data ?? []) as { entry_date: string }[]).map((row) => row.entry_date))
      const legacy = loadJson(KEY, parseWeights) ?? []
      const rows = legacy
        .filter((e) => !existing.has(e.date))
        .map((e) => ({ user_id: userId, entry_date: e.date, kg: e.kg }))
      if (rows.length > 0) {
        const { error: upsertError } = await supabase!
          .from('weight_entries')
          .upsert(rows, { onConflict: 'user_id,entry_date' })
        if (upsertError) throw upsertError
      }
      localStorage.setItem(IMPORT_MARKER + userId, 'done')
    }

    const channel = supabase
      .channel(`weight-entries:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'weight_entries', filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (!active) return
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as
          { entry_date?: string; kg?: number | string }
        if (!row.entry_date) return
        const date = row.entry_date
        if (payload.eventType === 'DELETE') {
          realtimeByDate.current.set(date, null)
        } else {
          // numeric-Spalten können als Zahl oder String kommen.
          const kg = typeof row.kg === 'number' ? row.kg
            : typeof row.kg === 'string' ? Number(row.kg)
            : NaN
          if (!Number.isFinite(kg) || kg < 30 || kg > 300) return
          realtimeByDate.current.set(date, kg)
        }
        // Eigener Upload läuft noch: Overlay merken, persist() wendet es nach.
        if (dirtyDates.current.has(date)) return
        applyRealtimeDate(date)
      })
      .subscribe((status) => {
        if (!active) return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Gewichts-Live-Synchronisierung unterbrochen. Bitte Verbindung prüfen.')
        }
      })

    void (async () => {
      try {
        await migrateLegacy()
        const fetched = await readAll()
        if (!active) return
        applyMerged(fetched)
        setError(null)
      } catch (cause) {
        if (!active) return
        // Offline/Fehler: Cache-Stand bleibt sichtbar.
        setError(cause instanceof Error
          ? `Gewichts-Verlauf konnte nicht geladen werden: ${cause.message}`
          : 'Gewichts-Synchronisierung fehlgeschlagen.')
      }
    })()

    return () => {
      active = false
      void supabase?.removeChannel(channel)
    }
  }, [userId, apply, applyRealtimeDate])

  const addWeight = useCallback((kg: number) => {
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) return false
    const date = toISODate(new Date())
    const next = [{ date, kg }, ...entriesRef.current.filter((e) => e.date !== date)]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    apply(next)
    void persist(date, kg)
    return true
  }, [apply, persist])

  return { entries, addWeight, error }
}
