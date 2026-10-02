import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadPhotoWithProgress, UploadHttpError } from '../lib/upload'
import { countQueuedPhotos, dequeuePhoto, enqueuePhoto, listQueuedPhotos } from '../lib/photoQueue'
import { parseISODate } from '../domain/dates'

const BUCKET = 'fitplan-meal-photos'
const TABLE = 'day_checks'
const IMPORT_VERSION = 'fitplanner.cloud-check-import.v1.'
const PAGE_SIZE = 1000

type CheckRow = {
  user_id: string
  week_start: string
  check_id: string
  is_checked: boolean
  photo_path: string | null
  updated_at?: string
}

type CheckRows = Record<string, CheckRow>
const rowKey = (row: Pick<CheckRow, 'week_start' | 'check_id'>) => `${row.week_start}|${row.check_id}`

/** Lokal beobachtete Änderung (Realtime-Ereignis oder eigener Schreibzugriff). */
type TouchedEntry = { row: CheckRow | null; at: number }

/**
 * Überlagert einen geladenen Cloud-Stand mit lokal beobachteten Änderungen,
 * die NACH Start des Ladens passiert sind (`since`). Ältere Beobachtungen
 * lassen den Serverstand gewinnen — Cloud bleibt Source of Truth, ohne dass
 * gleichzeitige lokale Aktionen verloren gehen (Race-Schutz).
 */
function mergeTouched(
  fetched: CheckRow[],
  touched: Map<string, TouchedEntry>,
  since: number,
): CheckRows {
  const merged: CheckRows = {}
  fetched.forEach((row) => { merged[rowKey(row)] = row })
  touched.forEach((entry, key) => {
    // Gleichstand gewinnt lokal: nie eine frische Benutzeraktion verlieren.
    if (entry.at < since) return
    if (entry.row) merged[key] = entry.row
    else delete merged[key]
  })
  return merged
}
const isTrainingId = (id: string) => /^d[0-6]-workout-0$/.test(id)
const isMealId = (id: string) => /^d[0-6]-meal-[0-3]$/.test(id)
const validMonday = (week: string) => {
  const parsed = parseISODate(week)
  return parsed !== null && parsed.getDay() === 1
}

async function readAllRows(userId: string): Promise<CheckRow[]> {
  if (!supabase) throw new Error('Supabase ist nicht konfiguriert.')
  const rows: CheckRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('user_id,week_start,check_id,is_checked,photo_path,updated_at')
      .eq('user_id', userId)
      .order('week_start', { ascending: true })
      .order('check_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data as CheckRow[]))
    if (!data || data.length < PAGE_SIZE) break
  }
  return rows
}

async function importLocalTrainingChecks(userId: string) {
  if (!supabase) return
  const marker = IMPORT_VERSION + userId
  try {
    if (localStorage.getItem(marker) === 'done') return
    const imports: CheckRow[] = []
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      const match = key?.match(/^fitplanner\.checks\.(\d{4}-\d{2}-\d{2})$/)
      if (!key || !match || !validMonday(match[1])) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const values: unknown = JSON.parse(raw)
      if (!Array.isArray(values)) continue
      for (const id of values) {
        if (typeof id === 'string' && isTrainingId(id)) {
          imports.push({ user_id: userId, week_start: match[1], check_id: id, is_checked: true, photo_path: null })
        }
      }
    }
    for (let offset = 0; offset < imports.length; offset += 500) {
      const { error } = await supabase.from(TABLE).upsert(imports.slice(offset, offset + 500), {
        onConflict: 'user_id,week_start,check_id', ignoreDuplicates: true,
      })
      if (error) throw error
    }
    localStorage.setItem(marker, 'done')
  } catch {
    // Retry migration on a later load; never mark the import complete on error.
    console.warn('Lokale Trainings-Häkchen konnten nicht vollständig importiert werden.')
  }
}

async function compressPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Bitte eine Bilddatei auswählen.')
  if (file.size > 12 * 1024 * 1024) throw new Error('Das Foto darf höchstens 12 MB groß sein.')
  let bitmap: ImageBitmap | undefined
  let objectUrl: string | undefined
  try {
    let source: CanvasImageSource
    let width: number
    let height: number
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file)
      source = bitmap
      width = bitmap.width
      height = bitmap.height
    } else {
      objectUrl = URL.createObjectURL(file)
      const image = new Image()
      image.src = objectUrl
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Das Foto konnte nicht gelesen werden.'))
      })
      source = image
      width = image.naturalWidth
      height = image.naturalHeight
    }
    if (!width || !height) throw new Error('Das Foto konnte nicht gelesen werden.')
    let scale = Math.min(1, 1600 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Bildverarbeitung wird von diesem Browser nicht unterstützt.')
    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(width * scale))
      canvas.height = Math.max(1, Math.round(height * scale))
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      const quality = Math.max(0.45, 0.82 - Math.floor(attempt / 2) * 0.12)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob) throw new Error('Das Foto konnte nicht komprimiert werden.')
      if (blob.size <= 8 * 1024 * 1024) return blob
      scale *= 0.8
    }
    throw new Error('Das Foto ist auch nach der Komprimierung zu groß. Bitte wähle ein kleineres Bild.')
  } finally {
    bitmap?.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

function cacheRows(rows: CheckRows, userId: string) {
  const grouped = new Map<string, string[]>()
  Object.values(rows).forEach((row) => {
    if (!row.is_checked || (isMealId(row.check_id) && !row.photo_path)) return
    const ids = grouped.get(row.week_start) ?? []
    ids.push(row.check_id)
    grouped.set(row.week_start, ids)
  })
  const prefix = `fitplanner.checks.${userId}.`
  try {
    const staleKeys: string[] = []
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key?.startsWith(prefix)) staleKeys.push(key)
    }
    staleKeys.forEach((key) => localStorage.removeItem(key))
    for (const [week, ids] of grouped) localStorage.setItem(`${prefix}${week}`, JSON.stringify(ids))
  } catch {
    // Browser storage is only a cache; Supabase remains the source of truth.
  }
}

function loadCachedRows(userId: string): CheckRows {
  const rows: CheckRows = {}
  const prefix = `fitplanner.checks.${userId}.`
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (!key?.startsWith(prefix)) continue
      const week = key.slice(prefix.length)
      const parsedWeek = parseISODate(week)
      const ids: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      if (!parsedWeek || parsedWeek.getDay() !== 1 || !Array.isArray(ids)) continue
      for (const id of ids) {
        // A local entry cannot prove that its meal photo exists in the cloud.
        if (typeof id !== 'string' || !isTrainingId(id)) continue
        rows[rowKey({ week_start: week, check_id: id })] = {
          user_id: userId, week_start: week, check_id: id, is_checked: true, photo_path: null,
        }
      }
    }
  } catch {
    // Ignore an invalid offline cache.
  }
  return rows
}

export function useSyncedChecks(userId: string, weekStart: string) {
  const [rows, setRows] = useState<CheckRows>({})
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyMealIds, setBusyMealIds] = useState<Set<string>>(() => new Set())
  /** Fortschritt in % je Mahlzeit-Check (echter XHR-Upload-Fortschritt). */
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  /** Anzahl Foto-Uploads, die offline in der Warteschlange liegen. */
  const [queuedCount, setQueuedCount] = useState(0)
  const busyKeys = useRef(new Set<string>())
  const touchedRows = useRef(new Map<string, TouchedEntry>())
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  /** Spiegelt das „active“-Flag des Ladens-Effekts für Queue-Worker. */
  const activeRef = useRef(true)

  const refreshQueuedCount = useCallback(() => {
    void countQueuedPhotos(userId).then((count) => {
      setQueuedCount(count)
    }).catch(() => undefined)
  }, [userId])

  const markMealBusy = useCallback((id: string, busy: boolean) => {
    setBusyMealIds((previous) => {
      const next = new Set(previous)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const commitRows = useCallback((update: (current: CheckRows) => CheckRows) => {
    const next = update(rowsRef.current)
    rowsRef.current = next
    cacheRows(next, userId)
    setRows(next)
  }, [userId])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setError('Supabase ist nicht konfiguriert.')
      return
    }
    let active = true
    activeRef.current = true
    touchedRows.current = new Map()
    const cachedRows = loadCachedRows(userId)
    rowsRef.current = cachedRows
    setRows(cachedRows)
    setPhotoUrls({})
    setLoading(true)
    setError(null)

    const refreshChecks = async () => {
      const since = Date.now()
      const fetched = await readAllRows(userId)
      if (!active) return
      commitRows(() => mergeTouched(fetched, touchedRows.current, since))
    }

    const channel = supabase
      .channel(`day-checks:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const value = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<CheckRow>
        if (!value.week_start || !value.check_id) return
        const key = rowKey(value as Pick<CheckRow, 'week_start' | 'check_id'>)
        const deleted = payload.eventType === 'DELETE' || value.is_checked === false
        touchedRows.current.set(key, { row: deleted ? null : value as CheckRow, at: Date.now() })
        commitRows((current) => {
          const next = { ...current }
          if (deleted) delete next[key]
          else next[key] = value as CheckRow
          return next
        })
      })
      .subscribe((status) => {
        if (!active) return
        if (status === 'SUBSCRIBED') {
          setError(null)
          void refreshChecks().catch((cause: unknown) => {
            if (active) setError(cause instanceof Error ? cause.message : 'Synchronisierung fehlgeschlagen.')
          })
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setError('Live-Synchronisierung unterbrochen. Bitte Verbindung prüfen.')
          if (status !== 'CLOSED') void refreshChecks().catch(() => undefined)
        }
      })

    void (async () => {
      try {
        await importLocalTrainingChecks(userId)
        const since = Date.now()
        const fetched = await readAllRows(userId)
        if (!active) return
        commitRows(() => mergeTouched(fetched, touchedRows.current, since))
        setError(null)
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Synchronisierung fehlgeschlagen.')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
      activeRef.current = false
      void supabase?.removeChannel(channel)
    }
  }, [userId, commitRows])

  const checked = useMemo(() => new Set(
    Object.values(rows).filter((row) => row.week_start === weekStart && row.is_checked).map((row) => row.check_id),
  ), [rows, weekStart])

  const checkedByWeek = useMemo(() => {
    const result: Record<string, Set<string>> = {}
    Object.values(rows).forEach((row) => {
      if (!row.is_checked) return
      result[row.week_start] ??= new Set<string>()
      result[row.week_start].add(row.check_id)
    })
    return result
  }, [rows])

  const photoSignature = useMemo(() => Object.values(rows)
    .filter((row) => row.week_start === weekStart && row.photo_path)
    .map((row) => `${row.check_id}:${row.photo_path}`)
    .sort()
    .join('|'), [rows, weekStart])

  useEffect(() => {
    if (!supabase || !photoSignature) {
      setPhotoUrls({})
      return
    }
    let active = true
    setPhotoUrls({})
    const photos = Object.values(rowsRef.current).filter((row) => row.week_start === weekStart && row.photo_path)
    const paths = photos.map((row) => row.photo_path!)
    void supabase.storage.from(BUCKET).createSignedUrls(paths, 3600).then(({ data, error: signedError }) => {
      if (!active) return
      if (signedError) {
        setError(signedError.message)
        setPhotoUrls({})
        return
      }
      const urls: Record<string, string> = {}
      photos.forEach((photo, index) => {
        const item = data?.[index]
        if (item?.signedUrl) urls[photo.check_id] = item.signedUrl
        else setError(item?.error ?? `Foto für ${photo.check_id} konnte nicht geladen werden.`)
      })
      setPhotoUrls(urls)
    }).catch((cause: unknown) => {
      if (!active) return
      setError(cause instanceof Error ? cause.message : 'Fotos konnten nicht geladen werden.')
      setPhotoUrls({})
    })
    return () => { active = false }
  }, [photoSignature, weekStart])

  const toggleCheck = useCallback(async (checkId: string) => {
    if (!supabase) throw new Error('Supabase ist nicht konfiguriert.')
    if (!validMonday(weekStart)) throw new Error('Ungültiger Wochenstart.')
    if (!isTrainingId(checkId) && !isMealId(checkId)) throw new Error('Ungültiger Tages-Check.')
    setError(null)
    const key = rowKey({ week_start: weekStart, check_id: checkId })
    const existing = rowsRef.current[key]
    if (isMealId(checkId) && (!existing?.is_checked || !existing.photo_path)) throw new Error('Für das Abhaken einer Mahlzeit ist ein gespeichertes Foto erforderlich.')
    if (busyKeys.current.has(key)) return
    busyKeys.current.add(key)
    if (isMealId(checkId)) markMealBusy(checkId, true)
    try {
      if (existing) {
        const { error: deleteError } = await supabase.from(TABLE).delete()
          .eq('user_id', userId).eq('week_start', weekStart).eq('check_id', checkId)
        if (deleteError) throw deleteError
        touchedRows.current.set(key, { row: null, at: Date.now() })
        commitRows((current) => {
          const next = { ...current }
          delete next[key]
          return next
        })
        setPhotoUrls((previous) => {
          const next = { ...previous }
          delete next[checkId]
          return next
        })
        if (existing.photo_path) {
          const { error: removeError } = await supabase.storage.from(BUCKET).remove([existing.photo_path])
          if (removeError) setError(`Häkchen entfernt; das Foto konnte nicht gelöscht werden: ${removeError.message}`)
        }
        return
      }

      const newRow: CheckRow = { user_id: userId, week_start: weekStart, check_id: checkId, is_checked: true, photo_path: null }
      const { error: saveError } = await supabase.from(TABLE).upsert(newRow, { onConflict: 'user_id,week_start,check_id' })
      if (saveError) throw saveError
      touchedRows.current.set(key, { row: newRow, at: Date.now() })
      commitRows((current) => ({ ...current, [key]: newRow }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Check konnte nicht synchronisiert werden.'
      setError(message)
      if (message.includes('Datenbank-Berechtigungen')) {
        const since = Date.now()
        void readAllRows(userId).then((fetched) => {
          // Nach Unmount/UserId-Wechsel nicht mehr in den Zustand schreiben.
          if (!activeRef.current) return
          commitRows(() => mergeTouched(fetched, touchedRows.current, since))
        }).catch(() => undefined)
      }
      throw cause
    } finally {
      busyKeys.current.delete(key)
      if (isMealId(checkId)) markMealBusy(checkId, false)
    }
  }, [userId, weekStart, commitRows, markMealBusy])

  const processQueue = useCallback(async () => {
    if (!supabase) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    const queued = await listQueuedPhotos(userId).catch(() => [])
    for (const entry of queued) {
      if (!activeRef.current) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      const entryKey = rowKey({ week_start: entry.weekStart, check_id: entry.checkId })
      if (busyKeys.current.has(entryKey)) continue
      busyKeys.current.add(entryKey)
      markMealBusy(entry.checkId, true)
      let uploadedPath: string | null = null
      let databaseCommitted = false
      try {
        const path = `${entry.userId}/${entry.weekStart}/${entry.checkId}/${crypto.randomUUID()}.jpg`
        await uploadPhotoWithProgress(supabase, BUCKET, path, entry.blob, (percent) => {
          if (activeRef.current) setUploadProgress((previous) => ({ ...previous, [entry.checkId]: percent }))
        })
        uploadedPath = path
        const previousPhoto = rowsRef.current[entryKey]?.photo_path ?? null
        const newRow: CheckRow = { user_id: entry.userId, week_start: entry.weekStart, check_id: entry.checkId, is_checked: true, photo_path: path }
        const { error: saveError } = await supabase.from(TABLE).upsert(newRow, { onConflict: 'user_id,week_start,check_id' })
        if (saveError) {
          const { data: confirmed, error: confirmError } = await supabase.from(TABLE)
            .select('user_id,week_start,check_id,is_checked,photo_path,updated_at')
            .eq('user_id', entry.userId).eq('week_start', entry.weekStart).eq('check_id', entry.checkId).maybeSingle()
          if (confirmError || confirmed?.photo_path !== path || !confirmed.is_checked) throw saveError
        }
        databaseCommitted = true
        touchedRows.current.set(entryKey, { row: newRow, at: Date.now() })
        commitRows((current) => ({ ...current, [entryKey]: newRow }))
        if (previousPhoto && previousPhoto !== path) {
          await supabase.storage.from(BUCKET).remove([previousPhoto]).catch(() => undefined)
        }
        await dequeuePhoto(entry.userId, entry.weekStart, entry.checkId)
        refreshQueuedCount()
      } catch {
        // Netzwerk/Sitzung noch nicht bereit: Eintrag bleibt in der Warteschlange,
        // der nächste Durchlauf versucht es erneut.
      } finally {
        if (uploadedPath && !databaseCommitted) {
          await supabase.storage.from(BUCKET).remove([uploadedPath]).catch(() => undefined)
        }
        busyKeys.current.delete(entryKey)
        markMealBusy(entry.checkId, false)
        if (activeRef.current) {
          setUploadProgress((previous) => {
            const next = { ...previous }
            delete next[entry.checkId]
            return next
          })
        }
      }
    }
  }, [userId, commitRows, markMealBusy, refreshQueuedCount])

  const completeMealWithPhoto = useCallback(async (checkId: string, file: File) => {
    if (!supabase) throw new Error('Supabase ist nicht konfiguriert.')
    if (!validMonday(weekStart)) throw new Error('Ungültiger Wochenstart.')
    if (!isMealId(checkId)) throw new Error('Ungültige Mahlzeit.')
    const key = rowKey({ week_start: weekStart, check_id: checkId })
    if (busyKeys.current.has(key)) return
    busyKeys.current.add(key)
    markMealBusy(checkId, true)
    setError(null)
    let uploadedPath: string | null = null
    let databaseCommitted = false
    try {
      const blob = await compressPhoto(file)
      const path = `${userId}/${weekStart}/${checkId}/${crypto.randomUUID()}.jpg`
      let uploadedViaQueueFallback = false
      try {
        await uploadPhotoWithProgress(supabase, BUCKET, path, blob, (percent) => {
          setUploadProgress((previous) => ({ ...previous, [checkId]: percent }))
        })
      } catch (uploadCause) {
        const isNetworkLike = uploadCause instanceof UploadHttpError && uploadCause.status === 0
        if (!isNetworkLike) throw uploadCause
        // Offline/Timeout: Blob in die Warteschlange, später automatisch nachholen.
        await enqueuePhoto({ userId, weekStart, checkId, blob })
        uploadedViaQueueFallback = true
        refreshQueuedCount()
      }
      if (uploadedViaQueueFallback) {
        // Der Check wird erst gesetzt, wenn der Upload wirklich durch ist.
        setError('Keine Verbindung — das Foto liegt sicher in der Warteschlange und wird automatisch nachgereicht.')
        busyKeys.current.delete(key)
        markMealBusy(checkId, false)
        setUploadProgress((previous) => {
          const next = { ...previous }
          delete next[checkId]
          return next
        })
        return
      }
      uploadedPath = path

      const previousPhoto = rowsRef.current[key]?.photo_path ?? null
      const newRow: CheckRow = { user_id: userId, week_start: weekStart, check_id: checkId, is_checked: true, photo_path: path }
      const { error: saveError } = await supabase.from(TABLE).upsert(newRow, { onConflict: 'user_id,week_start,check_id' })
      if (saveError) {
        // A timeout can happen after PostgreSQL committed. Reconcile before
        // deleting the uploaded object, which may already be referenced.
        const { data: confirmed, error: confirmError } = await supabase.from(TABLE)
          .select('user_id,week_start,check_id,is_checked,photo_path,updated_at')
          .eq('user_id', userId).eq('week_start', weekStart).eq('check_id', checkId).maybeSingle()
        if (confirmError || confirmed?.photo_path !== path || !confirmed.is_checked) throw saveError
      }
      databaseCommitted = true
      touchedRows.current.set(key, { row: newRow, at: Date.now() })
      commitRows((current) => ({ ...current, [key]: newRow }))
      if (previousPhoto && previousPhoto !== path) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([previousPhoto])
        if (removeError) setError(`Foto gespeichert; das vorherige Foto konnte nicht gelöscht werden: ${removeError.message}`)
      }
    } catch (cause) {
      if (uploadedPath && !databaseCommitted) await supabase.storage.from(BUCKET).remove([uploadedPath]).catch(() => undefined)
      setError(cause instanceof Error ? cause.message : 'Foto konnte nicht synchronisiert werden.')
      throw cause
    } finally {
      busyKeys.current.delete(key)
      markMealBusy(checkId, false)
      setUploadProgress((previous) => {
        const next = { ...previous }
        delete next[checkId]
        return next
      })
    }
  }, [userId, weekStart, commitRows, markMealBusy, refreshQueuedCount])

  // Queue-Worker: holt gespeicherte Foto-Uploads nach, sobald wieder
  // Netzwerk besteht. Reagiert auf online-Event und prüft zusätzlich
  // periodisch (z. B. Browser ohne zuverlässige online-Events, Session-
  // Erneuerung nach Ruhezustand).
  useEffect(() => {
    if (!supabase) return
    refreshQueuedCount()
    void processQueue()
    const onOnline = () => { void processQueue() }
    window.addEventListener('online', onOnline)
    const interval = window.setInterval(() => { void processQueue() }, 30_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(interval)
    }
  }, [processQueue, refreshQueuedCount])

  return { checked, checkedByWeek, photoUrls, loading, error, busyMealIds, uploadProgress, queuedCount, processQueue, toggleCheck, completeMealWithPhoto }
}
