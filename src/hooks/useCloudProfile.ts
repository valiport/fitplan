import { useCallback, useEffect, useState } from 'react'
import { parseProfile } from './useProfile'
import { supabase } from '../lib/supabase'
import type { Profile } from '../domain/types'

const LEGACY_KEY = 'fitplanner.profile.v1'
const profileKey = (userId: string) => `fitplanner.profile.v1.${userId}`

export function useCloudProfile(userId: string) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setReady(false)
      setError('Supabase ist nicht konfiguriert.')
      return
    }
    let active = true
    let realtimeProfile: Profile | null | undefined
    const key = profileKey(userId)
    let cachedProfile: Profile | null = null
    let legacyProfile: Profile | null = null
    try {
      const cachedRaw = localStorage.getItem(key)
      cachedProfile = cachedRaw ? parseProfile(JSON.parse(cachedRaw)) : null
      const legacyRaw = localStorage.getItem(LEGACY_KEY)
      legacyProfile = legacyRaw ? parseProfile(JSON.parse(legacyRaw)) : null
      setProfile(cachedProfile)
    } catch {
      cachedProfile = null
      legacyProfile = null
      setProfile(null)
    }
    setLoading(true)
    setReady(false)
    setError(null)

    const applyProfile = (next: Profile | null) => {
      setProfile(next)
      setReady(true)
      setLoading(false)
      setError(null)
      try {
        if (next) localStorage.setItem(key, JSON.stringify(next))
        else localStorage.removeItem(key)
      } catch { /* Cloud bleibt führend. */ }
    }

    const channel = supabase
      .channel(`user-profile:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, (payload) => {
        if (!active) return
        if (payload.eventType === 'DELETE') {
          realtimeProfile = null
          applyProfile(null)
          try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignoriert */ }
          return
        }
        const row = payload.new as { user_id?: string; profile_data?: unknown }
        if (row.user_id !== userId) return
        const next = parseProfile(row.profile_data)
        if (!next) {
          realtimeProfile = null
          setProfile(null)
          setReady(false)
          setError('Das gespeicherte Cloud-Profil ist ungültig. Bitte richte dein Profil neu ein.')
          return
        }
        realtimeProfile = next
        applyProfile(next)
        try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignoriert */ }
      })
      .subscribe((status) => {
        if (!active) return
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Profil-Live-Synchronisierung unterbrochen. Bitte Verbindung prüfen.')
        }
      })

    void (async () => {
      try {
        const { data, error: queryError } = await supabase!
          .from('user_profiles')
          .select('profile_data')
          .eq('user_id', userId)
          .maybeSingle()
        if (!active) return
        if (queryError) throw queryError

        if (realtimeProfile !== undefined) {
          applyProfile(realtimeProfile)
        } else if (data) {
          const cloudProfile = parseProfile(data.profile_data)
          if (!cloudProfile) throw new Error('Das gespeicherte Cloud-Profil ist ungültig. Bitte wende dich an den Support.')
          applyProfile(cloudProfile)
          try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignoriert */ }
        } else if (legacyProfile) {
          const { error: migrateError } = await supabase!.from('user_profiles').upsert({
            user_id: userId,
            profile_data: legacyProfile,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          if (!active) return
          if (migrateError) throw new Error(`Profil konnte nicht in die Cloud übernommen werden: ${migrateError.message}`)
          // The Realtime insert may already have been handled while migration ran.
          applyProfile(realtimeProfile !== undefined ? realtimeProfile : legacyProfile)
          try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignoriert */ }
        } else {
          applyProfile(null)
        }
      } catch (cause) {
        if (!active) return
        setProfile(cachedProfile)
        setError(cause instanceof Error ? `Profil-Synchronisierung fehlgeschlagen: ${cause.message}` : 'Profil-Synchronisierung fehlgeschlagen.')
        setLoading(false)
      }
    })()

    return () => {
      active = false
      void supabase?.removeChannel(channel)
    }
  }, [userId, retryCount])

  const retry = useCallback(() => {
    setRetryCount((count) => count + 1)
  }, [])

  const save = useCallback(async (nextProfile: Profile) => {
    if (!supabase || !ready) return false
    const key = profileKey(userId)
    setError(null)
    try {
      const { error: saveError } = await supabase.from('user_profiles').upsert({
        user_id: userId,
        profile_data: nextProfile,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (saveError) throw saveError
      try { localStorage.setItem(key, JSON.stringify(nextProfile)) } catch { /* Cloud bleibt führend. */ }
      setProfile(nextProfile)
      return true
    } catch (cause) {
      setError(`Profil konnte nicht sicher synchronisiert werden: ${cause instanceof Error ? cause.message : 'Cloud-Fehler.'}`)
      return false
    }
  }, [userId, ready])

  const clear = useCallback(async () => {
    if (!supabase || !ready) return
    try {
      const { error: deleteError } = await supabase.from('user_profiles').delete().eq('user_id', userId)
      if (deleteError) throw deleteError
      try { localStorage.removeItem(profileKey(userId)) } catch { /* ignoriert */ }
      try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignoriert */ }
      setProfile(null)
      setError(null)
    } catch (cause) {
      setError(`Profil konnte nicht aus der Cloud gelöscht werden: ${cause instanceof Error ? cause.message : 'Cloud-Fehler.'}`)
    }
  }, [userId, ready])

  return { profile, loading, ready, error, save, clear, retry }
}
