// Demo-Modus (ohne Cloud): ehrliche Fehler statt toter Pending-Trades oder
// stiller Schein-Verkäufe. Validierung greift IMMER — auch ohne Cloud — damit
// die Economy-Regeln (bekannte Platte, Stückzahl 1–10, Mindestpreis) überall
// gelten.

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFriends, useTrades, useMarket, demoMinPrice } from './useCollectionSocial'
import { MIN_PRICE } from '../domain/plates'

vi.mock('../lib/supabase', () => ({
  supabase: null,
  supabaseConfigured: false,
  supabaseConfigurationError: null,
  supabaseProjectUrl: null,
}))

beforeEach(() => {
  localStorage.clear()
})

describe('useFriends (Demo)', () => {
  it('liefert drei Demo-Freunde und keine offenen Anfragen', async () => {
    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.friends.map((f) => f.id)).toEqual(['demo-friend-1', 'demo-friend-2', 'demo-friend-3'])
    expect(result.current.requests).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('sendRequest/respondRequest/removeFriend werfen ehrliche Cloud-Fehler', async () => {
    const { result } = renderHook(() => useFriends('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await expect(result.current.sendRequest('befce79e-503a-4403-89bf-ed73be442a2d'))
        .rejects.toThrow('Freundschaftsanfragen benötigen die Cloud.')
      await expect(result.current.respondRequest('f1', true))
        .rejects.toThrow('Freundschaftsanfragen benötigen die Cloud.')
      await expect(result.current.removeFriend('demo-friend-1'))
        .rejects.toThrow('Freundschaft entfernen benötigt die Cloud.')
    })
  })
})

describe('useTrades (Demo)', () => {
  it('zeigt keine toten Pending-Trades', async () => {
    const { result } = renderHook(() => useTrades('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.trades).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('validiert Items vor der Cloud-Abfrage: leere Seite', async () => {
    const { result } = renderHook(() => useTrades('user-1', []))
    await act(async () => {
      await expect(result.current.createTrade('user-2', {}, { 'gp-5': 1 }))
        .rejects.toThrow('Der Tausch muss mindestens eine Platte enthalten.')
      await expect(result.current.createTrade('user-2', { 'cp-125': 1 }, {}))
        .rejects.toThrow('Der Tausch muss mindestens eine Platte enthalten.')
    })
  })

  it('validiert Items: unbekannte Platte', async () => {
    const { result } = renderHook(() => useTrades('user-1', []))
    await act(async () => {
      await expect(result.current.createTrade('user-2', { 'hack-999': 1 }, { 'gp-5': 1 }))
        .rejects.toThrow('Unbekannte Platte im Tausch.')
    })
  })

  it('validiert Items: Stückzahl 1–10 (0, 11, Bruch)', async () => {
    const { result } = renderHook(() => useTrades('user-1', []))
    await act(async () => {
      await expect(result.current.createTrade('user-2', { 'cp-125': 0 }, { 'gp-5': 1 }))
        .rejects.toThrow('Ungültige Stückzahl (1–10).')
      await expect(result.current.createTrade('user-2', { 'cp-125': 11 }, { 'gp-5': 1 }))
        .rejects.toThrow('Ungültige Stückzahl (1–10).')
      await expect(result.current.createTrade('user-2', { 'cp-125': 1.5 }, { 'gp-5': 1 }))
        .rejects.toThrow('Ungültige Stückzahl (1–10).')
    })
  })

  it('gültiger Tausch wirft trotzdem ehrlichen Cloud-Fehler (kein Pending-Eintrag)', async () => {
    const { result } = renderHook(() => useTrades('user-1', []))
    await act(async () => {
      await expect(result.current.createTrade('user-2', { 'cp-125': 1 }, { 'gp-5': 1 }))
        .rejects.toThrow('Tauschen braucht die Cloud (Demo-Modus: nur Ansehen).')
    })
    expect(result.current.trades).toEqual([])
  })

  it('respondToTrade wirft, cancelTrade entfernt lokal', async () => {
    const { result } = renderHook(() => useTrades('user-1', []))
    await act(async () => {
      await expect(result.current.respondToTrade('t1', true))
        .rejects.toThrow('Tausch-Reaktionen brauchen die Cloud (Demo-Modus nur Anfragen).')
      await result.current.cancelTrade('t1')
    })
    expect(result.current.trades).toEqual([])
  })
})

describe('useMarket (Demo)', () => {
  it('listet nichts (keine Schein-Angebote)', async () => {
    const { result } = renderHook(() => useMarket('user-1', []))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.listings).toEqual([])
    expect(result.current.ownListings).toEqual([])
    expect(result.current.transactions).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('createListing validiert Platte und Mindestpreis OHNE Cloud', async () => {
    const { result } = renderHook(() => useMarket('user-1', []))
    await act(async () => {
      await expect(result.current.createListing('hack-999', 100))
        .rejects.toThrow('Unbekannte Platte.')
      await expect(result.current.createListing('cp-125', MIN_PRICE.common - 1))
        .rejects.toThrow(`Mindestpreis für common-Platten: ${MIN_PRICE.common} Coins.`)
    })
  })

  it('gültiges Listing wirft ehrlichen Cloud-Fehler', async () => {
    const { result } = renderHook(() => useMarket('user-1', []))
    await act(async () => {
      await expect(result.current.createListing('cp-125', MIN_PRICE.common))
        .rejects.toThrow('Verkaufen braucht die Cloud (Demo-Modus: nur Ansehen).')
      await expect(result.current.buyListing('l1'))
        .rejects.toThrow('Kaufen braucht die Cloud (Demo-Modus: nur Ansehen).')
      await expect(result.current.cancelListing('l1'))
        .rejects.toThrow('Angebote zurückziehen braucht die Cloud (Demo-Modus: nur Ansehen).')
    })
  })

  it('demoMinPrice entspricht MIN_PRICE', () => {
    expect(demoMinPrice('common')).toBe(MIN_PRICE.common)
    expect(demoMinPrice('legendary')).toBe(MIN_PRICE.legendary)
  })
})
