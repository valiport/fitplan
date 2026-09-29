// Ausrüstung des Nutzers (Pro-Feature): pro Sportart gespeichert, damit
// z. B. Laufschuhe-Zuhause und Studio-Karte koexistieren können.
// Cloud-synchronisiert (Tabelle user_equipment): Cloud ist führend,
// localStorage dient als sofortiger Cache und Offline-Fallback. Eigene
// Änderungen laufen optimistisch lokal und werden dann hochgeschrieben.

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadJson, removeKey, saveJson } from '../domain/storage'
import { supabase } from '../lib/supabase'
import { useUserRealtime } from './useUserRealtime'
import type { Equipment, EquipmentSet, Sport } from '../domain/types'

const LEGACY_PREFIX = 'fitplanner.equipment.'
const cacheKey = (userId: string, sport: Sport) => `${LEGACY_PREFIX}${userId}.${sport}`
const IMPORT_MARKER = 'fitplanner.cloud-equipment-import.v1.'

const SPORTS: Sport[] = ['running', 'cycling', 'strength', 'team', 'combat']

const KNOWN: Equipment[] = [
  'none', 'dumbbells', 'barbell', 'bands', 'pullup', 'kettlebell',
  'bench', 'bike', 'gym', 'track', 'balls', 'pads',
]

function parseSet(raw: unknown): EquipmentSet | null {
  if (!Array.isArray(raw)) return null
  if (!raw.every((x) => typeof x === 'string')) return null
  // Nur bekannte Werte durchlassen.
  return [...new Set(raw.filter((x): x is Equipment => KNOWN.includes(x as Equipment)))]
}

/** Cached-Stand pro Sportart (leere Mengen werden nicht gecacht). */
function readCached(userId: string): Record<string, EquipmentSet> {
  const out: Record<string, EquipmentSet> = {}
  for (const sport of SPORTS) {
    const cached = loadJson(cacheKey(userId, sport), parseSet)
    if (cached && cached.length > 0) out[sport] = cached
  }
  return out
}

export function useEquipment(userId: string, sport: Sport) {
  const [bySport, setBySport] = useState<Record<string, EquipmentSet>>(() => readCached(userId))
  const bySportRef = useRef(bySport)
  const [error, setError] = useState<string | null>(null)

  const applySport = useCallback((changedSport: Sport, next: EquipmentSet) => {
    bySportRef.current = { ...bySportRef.current, [changedSport]: next }
    setBySport(bySportRef.current)
    if (next.length === 0) removeKey(cacheKey(userId, changedSport))
    else saveJson(cacheKey(userId, changedSport), next)
  }, [userId])

  const dirtySports = useRef(new Set<string>()) // lokal geändert, Fetch/Realtime soll sie nicht überschreiben
  // Realtime-Überlagerung pro Sportart; null = in der Cloud gelöscht.
  const realtimeBySport = useRef<Record<string, EquipmentSet | null>>({})

  const persist = useCallback(async (changedSport: Sport, next: EquipmentSet) => {
    if (!supabase) return
    dirtySports.current.add(changedSport)
    delete realtimeBySport.current[changedSport] // eigener Upload ist ab jetzt führend
    try {
      if (next.length === 0) {
        const { error: deleteError } = await supabase
          .from('user_equipment')
          .delete()
          .eq('user_id', userId)
          .eq('sport', changedSport)
        if (deleteError) throw deleteError
      } else {
        const { error: upsertError } = await supabase
          .from('user_equipment')
          .upsert({
            user_id: userId,
            sport: changedSport,
            equipment_data: next,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,sport' })
        if (upsertError) throw upsertError
      }
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error
        ? `Geräte konnten nicht synchronisiert werden: ${cause.message}`
        : 'Geräte-Synchronisierung fehlgeschlagen.')
    } finally {
      dirtySports.current.delete(changedSport)
      // Während des Uploads eingetroffene Remote-Werte jetzt anwenden.
      if (changedSport in realtimeBySport.current) {
        const pending = realtimeBySport.current[changedSport]
        delete realtimeBySport.current[changedSport]
        applySport(changedSport, pending ?? [])
      }
    }
  }, [userId, applySport])

  // Live-Synchronisierung: Kanal in eigenem Hook (Lebensdauer, Fehler, Filter).
  useUserRealtime({
    channel: 'user-equipment',
    table: 'user_equipment',
    userId,
    onRow: (event, raw) => {
      const row = raw as { sport?: string; equipment_data?: unknown }
      const changedSport = row.sport
      if (!changedSport) return
      if (event === 'DELETE') {
        realtimeBySport.current[changedSport] = null
        if (!dirtySports.current.has(changedSport)) applySport(changedSport as Sport, [])
      } else {
        const parsed = parseSet(row.equipment_data)
        if (!parsed) return
        realtimeBySport.current[changedSport] = parsed
        if (!dirtySports.current.has(changedSport)) applySport(changedSport as Sport, parsed)
      }
    },
    onChannelError: () => setError('Geräte-Live-Synchronisierung unterbrochen. Bitte Verbindung prüfen.'),
  })

  // Cloud laden + Migration alter Lokaldaten.
  useEffect(() => {
    if (!supabase) return
    let active = true
    realtimeBySport.current = {}

    const applyMerged = (fetched: Record<string, EquipmentSet>) => {
      const merged: Record<string, EquipmentSet> = { ...fetched }
      for (const [sportKey, value] of Object.entries(realtimeBySport.current)) {
        if (value === null) delete merged[sportKey]
        else merged[sportKey] = value
      }
      for (const sportKey of dirtySports.current) {
        const local = bySportRef.current[sportKey]
        if (local && local.length > 0) merged[sportKey] = local
        else delete merged[sportKey]
      }
      bySportRef.current = merged
      setBySport(merged)
      for (const [sportKey, value] of Object.entries(merged)) {
        if (value.length === 0) removeKey(cacheKey(userId, sportKey as Sport))
        else saveJson(cacheKey(userId, sportKey as Sport), value)
      }
      for (const sportKey of Object.keys(realtimeBySport.current)) {
        if (realtimeBySport.current[sportKey] === null) removeKey(cacheKey(userId, sportKey as Sport))
      }
    }

    const readAll = async (): Promise<Record<string, EquipmentSet>> => {
      const { data, error: queryError } = await supabase!
        .from('user_equipment')
        .select('sport,equipment_data')
        .eq('user_id', userId)
      if (queryError) throw queryError
      const result: Record<string, EquipmentSet> = {}
      for (const row of (data ?? []) as { sport: string; equipment_data: unknown }[]) {
        const parsed = parseSet(row.equipment_data)
        if (parsed) result[row.sport] = parsed
      }
      return result
    }

    const migrateLegacy = async () => {
      if (localStorage.getItem(IMPORT_MARKER + userId) === 'done') return
      const { data, error: queryError } = await supabase!
        .from('user_equipment')
        .select('sport')
        .eq('user_id', userId)
      if (queryError) throw queryError
      const existing = new Set(((data ?? []) as { sport: string }[]).map((row) => row.sport))
      const rows = []
      for (const sport of SPORTS) {
        const legacy = loadJson(LEGACY_PREFIX + sport, parseSet)
        if (legacy && legacy.length > 0 && !existing.has(sport)) {
          rows.push({ user_id: userId, sport, equipment_data: legacy })
        }
      }
      if (rows.length > 0) {
        const { error: upsertError } = await supabase!
          .from('user_equipment')
          .upsert(rows, { onConflict: 'user_id,sport' })
        if (upsertError) throw upsertError
      }
      localStorage.setItem(IMPORT_MARKER + userId, 'done')
    }


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
          ? `Geräte konnten nicht geladen werden: ${cause.message}`
          : 'Geräte-Synchronisierung fehlgeschlagen.')
      }
    })()

    return () => {
      active = false
    }
  }, [userId, applySport])

  const equipment = bySport[sport] ?? []

  const toggle = useCallback(
    (id: Equipment) => {
      const current = bySportRef.current[sport] ?? []
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
      applySport(sport, next)
      void persist(sport, next)
    },
    [sport, applySport, persist],
  )

  const reset = useCallback(() => {
    applySport(sport, [])
    void persist(sport, [])
  }, [sport, applySport, persist])

  return { equipment, toggle, reset, error }
}
