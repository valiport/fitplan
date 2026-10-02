// Race-Regression für useSyncedChecks: lokale Häkchen-Änderungen dürfen nie
// von einem gleichzeitigen (veralteten) Cloud-Fetch überschrieben werden —
// in beide Richtungen (verlorenes Häkchen, wiederbelebtes Häkchen).

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseQueryResult } from '../test/supabaseMock'
import {
  clearSupabaseMock,
  emitRealtimeChange,
  emitSubscribeStatus,
  queueMutation,
  queueResult,
} from '../test/supabaseMock'
import { useSyncedChecks } from './useSyncedChecks'

vi.mock('../lib/supabase', async () => {
  const { supabaseMockClient } = await import('../test/supabaseMock')
  return {
    supabase: supabaseMockClient,
    supabaseConfigured: true,
    supabaseConfigurationError: null,
    supabaseProjectUrl: 'https://example.supabase.co',
  }
})

// Upload/Queue laufen über IndexedDB/XHR — für diese Tests irrelevant.
vi.mock('../lib/photoQueue', () => ({
  countQueuedPhotos: vi.fn(async () => 0),
  listQueuedPhotos: vi.fn(async () => []),
  enqueuePhoto: vi.fn(async () => undefined),
  dequeuePhoto: vi.fn(async () => undefined),
}))

vi.mock('../lib/upload', () => ({
  uploadPhotoWithProgress: vi.fn(async () => undefined),
  UploadHttpError: class UploadHttpError extends Error {
    status = 0
  },
}))

const WEEK = '2026-09-28' // Montag
const CHECK = 'd0-workout-0'
const ROW = { user_id: 'user-1', week_start: WEEK, check_id: CHECK, is_checked: true, photo_path: null }

/** Deferred-Result für den Select-Queue — Rennsituation deterministisch steuern. */
function deferredResult(): { promise: Promise<SupabaseQueryResult>; resolve: (r: SupabaseQueryResult) => void } {
  let resolve!: (r: SupabaseQueryResult) => void
  const promise = new Promise<SupabaseQueryResult>((res) => { resolve = res })
  return { promise, resolve }
}

beforeEach(() => {
  clearSupabaseMock()
  localStorage.clear()
})

describe('Race: lokaler Commit vs. gleichzeitiger Cloud-Fetch', () => {
  it('ein gerade abgehakter Check überlebt einen Fetch mit altem Stand', async () => {
    queueResult('day_checks', { data: [], error: null })
    const { result } = renderHook(() => useSyncedChecks('user-1', WEEK))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.checked.has(CHECK)).toBe(false)

    // Refresh startet und bleibt an einem (veralteten) Fetch hängen …
    const stale = deferredResult()
    queueResult('day_checks', stale.promise)
    act(() => { emitSubscribeStatus('SUBSCRIBED') })

    // … währenddessen hakt der Nutzer lokal ab.
    queueMutation('day_checks', { data: null, error: null })
    await act(async () => {
      await result.current.toggleCheck(CHECK)
    })
    expect(result.current.checked.has(CHECK)).toBe(true)

    // Der Fetch löst mit ALT-ohne-Zeile auf: darf den Commit nicht überschreiben.
    await act(async () => {
      stale.resolve({ data: [], error: null })
    })
    expect(result.current.checked.has(CHECK)).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('ein lokal entfernter Check bleibt entfernt, auch wenn der Fetch ihn noch liefert', async () => {
    queueResult('day_checks', { data: [ROW], error: null })
    const { result } = renderHook(() => useSyncedChecks('user-1', WEEK))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.checked.has(CHECK)).toBe(true)

    // Stale Fetch starten (liefert gleich die Zeile wieder) …
    const stale = deferredResult()
    queueResult('day_checks', stale.promise)
    act(() => { emitSubscribeStatus('SUBSCRIBED') })

    // … und der Nutzer hakt inzwischen ab (Delete).
    queueMutation('day_checks', { data: null, error: null })
    await act(async () => {
      await result.current.toggleCheck(CHECK)
    })
    expect(result.current.checked.has(CHECK)).toBe(false)

    await act(async () => {
      stale.resolve({ data: [ROW], error: null })
    })
    expect(result.current.checked.has(CHECK)).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('checked-Set-Stabilität', () => {
  it('bleibt über Re-Renders identisch (memoisiert, keine neue Referenz pro Render)', async () => {
    queueResult('day_checks', { data: [ROW], error: null })
    const { result, rerender } = renderHook(() => useSyncedChecks('user-1', WEEK))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const first = result.current.checked
    rerender()
    rerender()
    expect(result.current.checked).toBe(first)
  })

  it('enthält keine Duplikate, wenn dieselbe Zeile zweimal per Realtime ankommt', async () => {
    queueResult('day_checks', { data: [], error: null })
    const { result } = renderHook(() => useSyncedChecks('user-1', WEEK))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { emitRealtimeChange({ eventType: 'INSERT', new: ROW, old: null }) })
    act(() => { emitRealtimeChange({ eventType: 'INSERT', new: ROW, old: null }) })
    expect(result.current.checked.size).toBe(1)
    expect(result.current.checked.has(CHECK)).toBe(true)
  })

  it('Realtime-DELETE entfernt die Zeile zuverlässig', async () => {
    queueResult('day_checks', { data: [ROW], error: null })
    const { result } = renderHook(() => useSyncedChecks('user-1', WEEK))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.checked.has(CHECK)).toBe(true)

    act(() => { emitRealtimeChange({ eventType: 'DELETE', old: ROW, new: null }) })
    expect(result.current.checked.has(CHECK)).toBe(false)
    // Der Wochen-Eintrag verschwindet ganz, wenn keine Checks mehr drin sind.
    expect(result.current.checkedByWeek[WEEK]?.has(CHECK) ?? false).toBe(false)
  })
})
