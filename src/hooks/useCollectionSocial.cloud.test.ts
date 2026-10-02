// Cloud-Verträge von useCollectionSocial: Jeder Economy-Schreibzugang geht
// AUSSCHLIESSLICH über benannte RPCs (create_trade, create_listing, …) — die
// Argumente sind der Betrugsschutz: keine Ziel-Rarity, keine Coins, keine
// freie Ziel-UUID beim Claim. Dazu: 30-s-Trade-Cooldown und die Sichtbarkeit
// eigener Angebote.

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFriends, useTrades, useMarket } from './useCollectionSocial'
import { clearSupabaseMock, queryCalls, queueResult, supabaseChannel, supabaseRpc } from '../test/supabaseMock'

vi.mock('../lib/supabase', async () => {
  const { supabaseMockClient } = await import('../test/supabaseMock')
  return {
    supabase: supabaseMockClient,
    supabaseConfigured: true,
    supabaseConfigurationError: null,
    supabaseProjectUrl: 'https://example.supabase.co',
  }
})

beforeEach(() => {
  clearSupabaseMock()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('create_trade: RPC-Vertrag', () => {
  it('sendet p_to/p_offered/p_requested und hängt den Trade pending an', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: 'trade-1', error: null })
    const { result } = renderHook(() => useTrades('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    let id = ''
    await act(async () => {
      id = await result.current.createTrade('user-2', { 'cp-125': 2 }, { 'gp-5': 1 })
    })

    expect(supabaseRpc).toHaveBeenCalledTimes(1)
    expect(supabaseRpc).toHaveBeenCalledWith('create_trade', {
      p_to: 'user-2',
      p_offered: { 'cp-125': 2 },
      p_requested: { 'gp-5': 1 },
    })
    expect(id).toBe('trade-1')
    expect(result.current.trades[0]).toMatchObject({
      id: 'trade-1',
      fromUserId: 'user-1',
      toUserId: 'user-2',
      status: 'pending',
      offered: { 'cp-125': 2 },
      requested: { 'gp-5': 1 },
    })
  })

  it('RPC-Fehler wird geworfen und kein Trade angehängt', async () => {
    // Systemzeit vorspulen: der Vortest hat den Cooldown (modullevel) gesetzt.
    // Der RPC schlägt fehl → lastTradeAt bleibt unberührt.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 120_000)
    supabaseRpc.mockResolvedValueOnce({ data: null, error: { message: 'Nicht genug Platten.' } })
    const { result } = renderHook(() => useTrades('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.createTrade('user-2', { 'cp-125': 1 }, { 'gp-5': 1 }))
        .rejects.toMatchObject({ message: 'Nicht genug Platten.' })
    })
    expect(result.current.trades).toEqual([])
  })
})

describe('respond_trade / cancel_trade: RPC-Verträge', () => {
  it('respond_trade sendet p_trade + p_accept und aktualisiert den Status', async () => {
    queueResult('trades', {
      data: [{ id: 't1', from_user_id: 'user-2', to_user_id: 'user-1', offered_items: { 'cp-125': 1 }, requested_items: {}, status: 'pending', created_at: '2026-10-01T10:00:00Z' }],
      error: null,
    })
    supabaseRpc.mockResolvedValueOnce({ data: null, error: null })
    const { result } = renderHook(() => useTrades('user-1', []))
    await waitFor(() => expect(result.current.trades).toHaveLength(1))

    await act(async () => {
      await result.current.respondToTrade('t1', true)
    })
    expect(supabaseRpc).toHaveBeenCalledWith('respond_trade', { p_trade: 't1', p_accept: true })
    expect(result.current.trades[0].status).toBe('accepted')
  })

  it('cancel_trade sendet p_trade und markiert als cancelled', async () => {
    queueResult('trades', {
      data: [{ id: 't2', from_user_id: 'user-1', to_user_id: 'user-2', offered_items: {}, requested_items: {}, status: 'pending', created_at: '2026-10-01T10:00:00Z' }],
      error: null,
    })
    supabaseRpc.mockResolvedValueOnce({ data: null, error: null })
    const { result } = renderHook(() => useTrades('user-1', []))
    await waitFor(() => expect(result.current.trades).toHaveLength(1))

    await act(async () => {
      await result.current.cancelTrade('t2')
    })
    expect(supabaseRpc).toHaveBeenCalledWith('cancel_trade', { p_trade: 't2' })
    expect(result.current.trades[0].status).toBe('cancelled')
  })
})

describe('create_listing / buy_listing / cancel_listing: RPC-Verträge', () => {
  it('create_listing sendet p_plate + p_price ab Mindestpreis', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: null, error: null })
    const { result } = renderHook(() => useMarket('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createListing('cp-125', 15)
    })
    expect(supabaseRpc).toHaveBeenCalledWith('create_listing', { p_plate: 'cp-125', p_price: 15 })
  })

  it('create_listing unter Mindestpreis wird clientseitig abgelehnt (kein RPC)', async () => {
    const { result } = renderHook(() => useMarket('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.createListing('gold-50', 3999))
        .rejects.toThrow('Mindestpreis für legendary-Platten: 4000 Coins.')
    })
    expect(supabaseRpc).not.toHaveBeenCalled()
  })

  it('buy_listing und cancel_listing senden nur p_listing', async () => {
    supabaseRpc.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useMarket('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.buyListing('l1')
      await result.current.cancelListing('l2')
    })
    expect(supabaseRpc).toHaveBeenCalledWith('buy_listing', { p_listing: 'l1' })
    expect(supabaseRpc).toHaveBeenCalledWith('cancel_listing', { p_listing: 'l2' })
  })

  it('RPC-Fehler beim Kauf wird geworfen', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: null, error: { message: 'Zu wenig Coins.' } })
    const { result } = renderHook(() => useMarket('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.buyListing('l1')).rejects.toMatchObject({ message: 'Zu wenig Coins.' })
    })
  })
})

describe('eigene Angebote sichtbar (Rückweg für reservierte Platten)', () => {
  it('trennt fremde und eigene Listings und filtert per eq(seller_id)', async () => {
    queueResult('market_listings', {
      data: [{ id: 'l1', seller_id: 'other-1', plate_id: 'cp-125', price: 20, status: 'active', created_at: '2026-10-01T10:00:00Z' }],
      error: null,
    })
    queueResult('user_profiles', {
      data: [{ user_id: 'other-1', profile_data: { displayName: 'Anna' } }],
      error: null,
    })
    queueResult('market_listings', {
      data: [{ id: 'l2', seller_id: 'user-1', plate_id: 'gp-5', price: 80, status: 'active', created_at: '2026-10-01T09:00:00Z' }],
      error: null,
    })
    queueResult('market_transactions', {
      data: [{ id: 'tx1', listing_id: 'l0', plate_id: 'bp-15', price: 300, buyer_id: 'user-1', seller_id: 'other-1', created_at: '2026-09-30T10:00:00Z' }],
      error: null,
    })

    const { result } = renderHook(() => useMarket('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.listings).toHaveLength(1)
    expect(result.current.listings[0]).toMatchObject({ id: 'l1', sellerName: 'Anna' })
    expect(result.current.ownListings).toHaveLength(1)
    expect(result.current.ownListings[0]).toMatchObject({ id: 'l2', sellerName: 'Du' })
    expect(result.current.transactions[0]).toMatchObject({ direction: 'buy', counterparty: 'other-1' })

    const listingCalls = queryCalls('market_listings')
    expect(listingCalls).toContainEqual({ table: 'market_listings', method: 'neq', args: ['seller_id', 'user-1'] })
    expect(listingCalls).toContainEqual({ table: 'market_listings', method: 'eq', args: ['seller_id', 'user-1'] })
    expect(listingCalls).toContainEqual({ table: 'market_listings', method: 'eq', args: ['status', 'active'] })
  })
})

describe('useFriends: Cloud-Verträge', () => {
  it('lädt angenommene Freunde mit Namen und nur eingehende Anfragen', async () => {
    queueResult('friends', {
      data: [
        { id: 'f1', user_id_a: 'user-1', user_id_b: 'friend-b', requested_by: 'friend-b', status: 'accepted', created_at: '2026-09-01T10:00:00Z' },
        { id: 'f2', user_id_a: 'friend-a', user_id_b: 'user-1', requested_by: 'friend-a', status: 'pending', created_at: '2026-10-01T10:00:00Z' },
        { id: 'f3', user_id_a: 'user-1', user_id_b: 'friend-c', requested_by: 'user-1', status: 'pending', created_at: '2026-10-01T11:00:00Z' },
      ],
      error: null,
    })
    queueResult('user_profiles', {
      data: [{ user_id: 'friend-b', profile_data: { displayName: 'Anna' } }],
      error: null,
    })

    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.friends).toEqual([{ id: 'friend-b', name: 'Anna' }])
    // f3 ist eine eigene ausgehende Anfrage — darf nicht als Anfrage erscheinen.
    expect(result.current.requests).toHaveLength(1)
    expect(result.current.requests[0]).toMatchObject({ id: 'f2', fromUserId: 'friend-a', toUserId: 'user-1' })
    expect(result.current.error).toBeNull()
  })

  it('ohne Profilname greift ein Namens-Fallback', async () => {
    queueResult('friends', {
      data: [{ id: 'f1', user_id_a: 'user-1', user_id_b: 'friend-b', requested_by: 'friend-b', status: 'accepted', created_at: '2026-09-01T10:00:00Z' }],
      error: null,
    })
    queueResult('user_profiles', { data: [], error: null })

    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.friends[0].name.startsWith('Nutzer ')).toBe(true)
  })

  it('send_request validiert die Ziel-UUID und sendet nur p_to', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: null, error: null })
    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.sendRequest('keine-uuid'))
        .rejects.toThrow('Bitte eine gültige Nutzer-UUID eingeben.')
      expect(supabaseRpc).not.toHaveBeenCalled()
      await result.current.sendRequest('befce79e-503a-4403-89bf-ed73be442a2d')
    })
    expect(supabaseRpc).toHaveBeenCalledWith('send_friend_request', {
      p_to: 'befce79e-503a-4403-89bf-ed73be442a2d',
    })
  })

  it('respond_friend_request sendet p_friend + p_accept', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: null, error: null })
    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.respondRequest('f2', true)
    })
    expect(supabaseRpc).toHaveBeenCalledWith('respond_friend_request', { p_friend: 'f2', p_accept: true })
  })

  it('remove_friend sendet nur p_friend (Freundschaft beenden)', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: null, error: null })
    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.removeFriend('f1')
    })
    expect(supabaseRpc).toHaveBeenCalledWith('remove_friend', { p_friend: 'f1' })
  })

  it('remove_friend wirft RPC-Fehler', async () => {
    supabaseRpc.mockResolvedValueOnce({ data: null, error: { message: 'Freundschaft nicht gefunden.' } })
    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.removeFriend('f1'))
        .rejects.toMatchObject({ message: 'Freundschaft nicht gefunden.' })
    })
  })
})

describe('Realtime-Anbindung', () => {
  it('abonniert user-gebundene Channels für Trades, Markt und Freunde', async () => {
    renderHook(() => useTrades('user-1', []))
    renderHook(() => useMarket('user-1', []))
    renderHook(() => useFriends('user-1'))
    await waitFor(() => {
      expect(supabaseChannel).toHaveBeenCalledWith('trades:user-1')
      expect(supabaseChannel).toHaveBeenCalledWith('market:user-1')
      expect(supabaseChannel).toHaveBeenCalledWith('friends:user-1')
    })
  })
})

// ⚠️ Dieser Test MUSS der letzte sein, der createTrade aufruft: der Cooldown
// ist modullevel (lastTradeAt) und die manipulierte Systemzeit überschreibt ihn
// in die Zukunft — spätere createTrade-Aufrufe würden sonst in den Cooldown
// laufen.
describe('Trade-Cooldown (30 s)', () => {
  it('blockiert schnelle Folge-Trades und lässt nach 30 s wieder zu', async () => {
    const base = Date.now() + 120_000
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(base)
    supabaseRpc.mockResolvedValue({ data: 'trade-n', error: null })

    const { result } = renderHook(() => useTrades('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createTrade('user-2', { 'cp-125': 1 }, { 'gp-5': 1 })
    })
    expect(supabaseRpc).toHaveBeenCalledTimes(1)

    await act(async () => {
      await expect(result.current.createTrade('user-2', { 'cp-125': 1 }, { 'gp-5': 1 }))
        .rejects.toThrow('Kurze Pause: Trades können nur alle 30 Sekunden erstellt werden.')
    })
    expect(supabaseRpc).toHaveBeenCalledTimes(1)

    vi.setSystemTime(base + 31_000)
    await act(async () => {
      await result.current.createTrade('user-2', { 'cp-125': 1 }, { 'gp-5': 1 })
    })
    expect(supabaseRpc).toHaveBeenCalledTimes(2)
  })
})
