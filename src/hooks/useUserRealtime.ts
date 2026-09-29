// Gemeinsamer Realtime-Kanal für nutzerspezifische Tabellen.
// Kapselt die Kanal-Lebensdauer: Active-Guard gegen Events nach Unmount,
// user_id-Filter, Fehlerstatus (CHANNEL_ERROR/TIMED_OUT) und removeChannel.
// Die fachliche Auswertung bleibt im aufrufenden Hook — dort gelten die
// Dirty-Guard-/Overlay-Invarianten (siehe AGENTS.md „Realtime sync invariant").

import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export type UserRowEvent = 'INSERT' | 'UPDATE' | 'DELETE'

type UserRealtimeOptions = {
  /** Kanal-Präfix, z. B. `weight-entries` (volle Name: `<präfix>:<userId>`). */
  channel: string
  table: string
  userId: string
  /** Row-Event; `row` ist payload.new bzw. payload.old (DELETE). */
  onRow: (event: UserRowEvent, row: Record<string, unknown>) => void
  /** Wird bei CHANNEL_ERROR/TIMED_OUT aufgerufen (z. B. für setError). */
  onChannelError?: () => void
}

export function useUserRealtime({
  channel,
  table,
  userId,
  onRow,
  onChannelError,
}: UserRealtimeOptions): void {
  // Callbacks über Refs: der Kanal bleibt stabil, auch wenn sich Closures ändern.
  const onRowRef = useRef(onRow)
  onRowRef.current = onRow
  const onErrorRef = useRef(onChannelError)
  onErrorRef.current = onChannelError

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let active = true
    const handle = client
      .channel(`${channel}:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload) => {
          if (!active) return
          const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as
            Record<string, unknown> | null
          if (!row) return
          onRowRef.current(payload.eventType as UserRowEvent, row)
        },
      )
      .subscribe((status) => {
        if (!active) return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onErrorRef.current?.()
      })
    return () => {
      active = false
      void client.removeChannel(handle)
    }
  }, [channel, table, userId])
}
