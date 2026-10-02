// Demo-Modus (ohne Cloud): die Economy-Regeln müssen lokal genauso strikt
// sein — 5 Coins pro Check, Upgrade frisst exakt 3 Duplikaten und vergibt
// genau 1 Platte der nächsten Stufe, ohne Coins zu verbrauchen.

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollection } from './useCollection'
import { COINS_PER_CHECK, getPlate, platesOfRarity } from '../domain/plates'

vi.mock('../lib/supabase', () => ({
  supabase: null,
  supabaseConfigured: false,
  supabaseConfigurationError: null,
  supabaseProjectUrl: null,
}))

const KEY = 'fitplanner.collection.v1.user-1'

const seed = (coins: number, inventory: Record<string, number>) => {
  localStorage.setItem(KEY, JSON.stringify({ coins, inventory }))
}

const current = () => JSON.parse(localStorage.getItem(KEY) ?? '{}') as { coins: number; inventory: Record<string, number> }

beforeEach(() => {
  localStorage.clear()
})

describe('addDrop (Demo)', () => {
  it('vergibt genau 5 Coins und 1 Platte, synchronisiert aber nicht', async () => {
    seed(10, { 'cp-125': 2 })
    const { result } = renderHook(() => useCollection('user-1'))

    let reward: Awaited<ReturnType<typeof result.current.addDrop>> | undefined
    await act(async () => {
      reward = await result.current.addDrop('2026-09-28', 'd0-workout-0', 0)
    })

    expect(reward!.granted).toBe(true)
    expect(getPlate(reward!.plate!.id)).not.toBeNull()
    expect(result.current.state.coins).toBe(10 + COINS_PER_CHECK)
    // Der gedroppte Platten-Typ wird um exakt 1 erhöht.
    const id = reward!.plate!.id
    expect(result.current.state.inventory[id]).toBe((id === 'cp-125' ? 2 : 0) + 1)
    expect(result.current.state.synced).toBe(false)
  })

  it('persistiert den Zustand im localStorage-Cache', async () => {
    seed(0, {})
    const { result } = renderHook(() => useCollection('user-1'))
    await act(async () => {
      await result.current.addDrop('2026-09-28', 'd0-workout-0', 0)
    })
    const saved = current()
    expect(saved.coins).toBe(COINS_PER_CHECK)
    expect(Object.values(saved.inventory).reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('stapelt Drops auf vorhandene Bestände', async () => {
    seed(0, { 'cp-125': 1, 'cp-25': 1 })
    const { result } = renderHook(() => useCollection('user-1'))
    await act(async () => {
      await result.current.addDrop('2026-09-28', 'd0-meal-0', 0)
    })
    const total = Object.values(result.current.state.inventory).reduce((a, b) => a + b, 0)
    expect(total).toBe(3)
  })
})

describe('applyUpgrade (Demo)', () => {
  it('verbraucht exakt 3 Duplikaten und vergibt 1 Platte der nächsten Stufe', async () => {
    seed(50, { 'cp-125': 3 })
    const { result } = renderHook(() => useCollection('user-1'))

    let ok = false
    await act(async () => {
      ok = await result.current.applyUpgrade('common')
    })

    expect(ok).toBe(true)
    const inventory = result.current.state.inventory
    const commons = platesOfRarity('common').reduce((sum, p) => sum + (inventory[p.id] ?? 0), 0)
    const uncommons = platesOfRarity('uncommon').reduce((sum, p) => sum + (inventory[p.id] ?? 0), 0)
    expect(commons).toBe(0)
    expect(uncommons).toBe(1)
    // Upgrade kostet keine Coins.
    expect(result.current.state.coins).toBe(50)
  })

  it('verbraucht gemischte Duplikaten deterministisch (3 von 4)', async () => {
    seed(0, { 'cp-125': 2, 'cp-25': 2 })
    const { result } = renderHook(() => useCollection('user-1'))

    await act(async () => {
      await result.current.applyUpgrade('common')
    })

    const inventory = result.current.state.inventory
    const commons = platesOfRarity('common').reduce((sum, p) => sum + (inventory[p.id] ?? 0), 0)
    const uncommons = platesOfRarity('uncommon').reduce((sum, p) => sum + (inventory[p.id] ?? 0), 0)
    expect(commons).toBe(1)
    expect(uncommons).toBe(1)
  })

  it('lehnt ab, wenn weniger als 3 Duplikaten vorhanden sind — Inventar bleibt unberührt', async () => {
    seed(0, { 'cp-125': 2 })
    const { result } = renderHook(() => useCollection('user-1'))

    let ok = true
    await act(async () => {
      ok = await result.current.applyUpgrade('common')
    })

    expect(ok).toBe(false)
    expect(result.current.state.inventory).toEqual({ 'cp-125': 2 })
  })

  it('lehnt Legendary-Upgrades ab (keine höhere Stufe)', async () => {
    seed(0, { 'gold-50': 3 })
    const { result } = renderHook(() => useCollection('user-1'))

    let ok = true
    await act(async () => {
      ok = await result.current.applyUpgrade('legendary')
    })

    expect(ok).toBe(false)
    expect(result.current.state.inventory).toEqual({ 'gold-50': 3 })
  })
})

describe('Demo-Startzustand', () => {
  it('startet leer ohne Cache', async () => {
    const { result } = renderHook(() => useCollection('user-1'))
    await waitFor(() => expect(result.current.state.coins).toBe(0))
    expect(result.current.state.inventory).toEqual({})
    expect(result.current.error).toBeNull()
  })
})
