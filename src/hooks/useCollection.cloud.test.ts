// Cloud-Verträge von useCollection: Claim-Argumente dürfen NIEMALS eine
// wählbare Ziel-UUID/Rarity/Coins enthalten (Betrugsschutz), und der Refresh
// muss autoritativ überschreiben statt zu mergen (Wallet-Drift-Regression).

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollection } from './useCollection'
import { clearSupabaseMock, queueResult, supabaseRpc } from '../test/supabaseMock'

vi.mock('../lib/supabase', async () => {
  const { supabaseMockClient } = await import('../test/supabaseMock')
  return {
    supabase: supabaseMockClient,
    supabaseConfigured: true,
    supabaseConfigurationError: null,
    supabaseProjectUrl: 'https://example.supabase.co',
  }
})

const KEY = 'fitplanner.collection.v1.user-1'

beforeEach(() => {
  clearSupabaseMock()
  localStorage.clear()
})

describe('claim_check_reward: RPC-Vertrag', () => {
  it('sendet NUR p_week und p_check — keine Ziel-UUID, keine Rarity, keine Coins', async () => {
    queueResult('collections', { data: { coins: 5, inventory: {} }, error: null })
    queueResult('collections', { data: { coins: 5, inventory: {} }, error: null })
    supabaseRpc.mockResolvedValueOnce({ data: { plate_id: 'cp-125', granted: true }, error: null })

    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))

    let reward: Awaited<ReturnType<typeof result.current.addDrop>>
    await act(async () => {
      reward = await result.current.addDrop('2026-09-28', 'd0-workout-0', 5)
    })

    expect(supabaseRpc).toHaveBeenCalledTimes(1)
    expect(supabaseRpc).toHaveBeenCalledWith('claim_check_reward', {
      p_week: '2026-09-28',
      p_check: 'd0-workout-0',
    })
    expect(reward!.granted).toBe(true)
    expect(reward!.plate?.id).toBe('cp-125')
  })

  it('granted=false wird durchgereicht, ohne Platte zu vergeben', async () => {
    queueResult('collections', { data: { coins: 5, inventory: {} }, error: null })
    supabaseRpc.mockResolvedValueOnce({ data: { plate_id: 'cp-125', granted: false }, error: null })

    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))

    let reward: Awaited<ReturnType<typeof result.current.addDrop>>
    await act(async () => {
      reward = await result.current.addDrop('2026-09-28', 'd0-workout-0', 5)
    })
    expect(reward!.granted).toBe(false)
    // Kein Einstich ins Inventar (Refresh liefert Serverwert 5/{} unverändert)
    expect(result.current.state.inventory).toEqual({})
  })

  it('unvollständige Server-Antwort wird abgelehnt', async () => {
    queueResult('collections', { data: { coins: 5, inventory: {} }, error: null })
    supabaseRpc.mockResolvedValueOnce({ data: { granted: true }, error: null })

    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))

    await act(async () => {
      await expect(result.current.addDrop('2026-09-28', 'd0-workout-0', 0))
        .rejects.toThrow('Ungültige Belohnungsantwort vom Server.')
    })
  })

  it('RPC-Fehler wird an den Aufrufer durchgereicht', async () => {
    queueResult('collections', { data: { coins: 5, inventory: {} }, error: null })
    supabaseRpc.mockResolvedValueOnce({ data: null, error: { message: 'Aufgabe ist zu alt.' } })

    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))

    await act(async () => {
      await expect(result.current.addDrop('2026-09-28', 'd0-workout-0', 0))
        .rejects.toMatchObject({ message: 'Aufgabe ist zu alt.' })
    })
  })
})

describe('autoritativer Refresh (Wallet-Drift-Regression)', () => {
  it('überschreibt lokalen Cache vollständig statt zu mergen', async () => {
    // Lokaler Cache behauptet 9999 Coins + Legendär-Platten …
    localStorage.setItem(KEY, JSON.stringify({ coins: 9999, inventory: { 'gold-50': 3 } }))
    // … die Cloud sagt 5 Coins und leer.
    queueResult('collections', { data: { coins: 5, inventory: {} }, error: null })

    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))

    expect(result.current.state.coins).toBe(5)
    expect(result.current.state.inventory).toEqual({})
  })

  it('setzt synced und überlebt einen leeren Cloud-Zeilenstand als leeren Start', async () => {
    queueResult('collections', { data: null, error: null })
    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))
    expect(result.current.state.coins).toBe(0)
    expect(result.current.error).toBeNull()
  })
})

describe('upgrade_collection: RPC-Vertrag', () => {
  it('sendet nur p_rarity und akzeptiert gültige Ziel-Platte', async () => {
    queueResult('collections', { data: { coins: 0, inventory: {} }, error: null })
    queueResult('collections', { data: { coins: 0, inventory: {} }, error: null })
    supabaseRpc.mockResolvedValueOnce({ data: 'gp-5', error: null })

    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))

    let ok = false
    await act(async () => {
      ok = await result.current.applyUpgrade('common')
    })
    expect(supabaseRpc).toHaveBeenCalledWith('upgrade_collection', { p_rarity: 'common' })
    expect(ok).toBe(true)
  })

  it('unbekannte Ziel-Platte liefert false', async () => {
    queueResult('collections', { data: { coins: 0, inventory: {} }, error: null })
    supabaseRpc.mockResolvedValueOnce({ data: 'hack-999', error: null })

    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.synced).toBe(true))

    let ok = true
    await act(async () => {
      ok = await result.current.applyUpgrade('common')
    })
    expect(ok).toBe(false)
  })
})

describe('Realtime-Anbindung', () => {
  it('abonmiert einen user-gebundenen Channel', async () => {
    queueResult('collections', { data: null, error: null })
    const { supabaseChannel } = await import('../test/supabaseMock')
    renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(supabaseChannel).toHaveBeenCalledWith('collection:user-1'))
  })
})
