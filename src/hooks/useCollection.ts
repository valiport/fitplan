// Sammlungs-Zustand: Coins + Inventar.
// Im Cloud-Modus sind RPCs die einzige Schreibquelle; LocalStorage wird nur
// als Cache verwendet. Ohne Cloud bleibt die Demo lokal funktionsfähig.

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadJson, saveJson } from '../domain/storage'
import { supabase } from '../lib/supabase'
import { COINS_PER_CHECK, getPlate, nextRarity, platesOfRarity } from '../domain/plates'
import type { Inventory, Plate, Rarity } from '../domain/plates'
import { rollDrop } from '../domain/drops'

const LOCAL_KEY = 'fitplanner.collection.v1'
const cacheKey = (userId: string) => `${LOCAL_KEY}.${userId}`

export interface CollectionState {
  coins: number
  inventory: Inventory
  synced: boolean
}

function parseCollection(raw: unknown): CollectionState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Record<string, unknown>
  if (!Number.isSafeInteger(value.coins) || (value.coins as number) < 0) return null
  if (typeof value.inventory !== 'object' || value.inventory === null || Array.isArray(value.inventory)) return null
  const inventory: Inventory = {}
  for (const [plateId, qty] of Object.entries(value.inventory as Record<string, unknown>)) {
    if (!getPlate(plateId)) continue
    if (!Number.isSafeInteger(qty) || (qty as number) <= 0) return null
    inventory[plateId] = qty as number
  }
  return { coins: value.coins as number, inventory, synced: false }
}

const emptyState: CollectionState = { coins: 0, inventory: {}, synced: false }

type RewardResult = { plate: Plate | null; granted: boolean }

export function useCollection(userId: string) {
  const [state, setState] = useState<CollectionState>(
    () => loadJson(cacheKey(userId), parseCollection) ?? emptyState,
  )
  const stateRef = useRef(state)
  stateRef.current = state
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback((next: CollectionState) => {
    stateRef.current = next
    setState(next)
    saveJson(cacheKey(userId), next)
  }, [userId])

  const refresh = useCallback(async () => {
    if (!supabase) return
    const { data, error: queryError } = await supabase
      .from('collections')
      .select('coins,inventory')
      .eq('user_id', userId)
      .maybeSingle()
    if (queryError) {
      setError(`Sammlung konnte nicht synchronisiert werden: ${queryError.message}`)
      throw queryError
    }
    if (!data) {
      apply({ ...emptyState, synced: true })
      setError(null)
      return
    }
    const next = parseCollection({ coins: data.coins, inventory: data.inventory })
    if (!next) {
      const invalid = new Error('Die Cloud-Sammlung enthält ungültige Daten.')
      setError(invalid.message)
      throw invalid
    }
    apply({ ...next, synced: true })
    setError(null)
  }, [userId, apply])

  useEffect(() => {
    if (!supabase) return
    let active = true
    const channel = supabase
      .channel(`collection:${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'collections', filter: `user_id=eq.${userId}`,
      }, () => {
        if (active) void refresh().catch(() => undefined)
      })
      .subscribe()
    void refresh().catch(() => undefined)
    return () => {
      active = false
      void supabase?.removeChannel(channel)
    }
  }, [userId, refresh])

  const addDrop = useCallback(async (weekStart: string, checkId: string, streak: number): Promise<RewardResult> => {
    if (supabase) {
      const { data, error: claimError } = await supabase.rpc('claim_check_reward', {
        p_week: weekStart,
        p_check: checkId,
      })
      if (claimError) throw claimError
      const result = data as { plate_id?: unknown; granted?: unknown } | null
      const plate = typeof result?.plate_id === 'string' ? getPlate(result.plate_id) : null
      if (!plate || typeof result?.granted !== 'boolean') throw new Error('Ungültige Belohnungsantwort vom Server.')
      await refresh()
      return { plate, granted: result.granted }
    }
    const result = rollDrop(streak)
    const current = stateRef.current
    apply({
      coins: current.coins + COINS_PER_CHECK,
      inventory: { ...current.inventory, [result.plate.id]: (current.inventory[result.plate.id] ?? 0) + 1 },
      synced: false,
    })
    return { plate: result.plate, granted: true }
  }, [apply, refresh])

  const applyUpgrade = useCallback(async (rarity: Rarity): Promise<boolean> => {
    if (supabase) {
      const { data, error: upgradeError } = await supabase.rpc('upgrade_collection', { p_rarity: rarity })
      if (upgradeError) {
        setError(upgradeError.message)
        return false
      }
      if (typeof data !== 'string' || !getPlate(data)) return false
      await refresh()
      return true
    }
    const pool = platesOfRarity(rarity)
    const current = stateRef.current
    const total = pool.reduce((sum, plate) => sum + (current.inventory[plate.id] ?? 0), 0)
    const target = nextRarity(rarity)
    if (total < 3 || !target) return false
    const inventory = { ...current.inventory }
    let remaining = 3
    for (const plate of pool) {
      const take = Math.min(inventory[plate.id] ?? 0, remaining)
      if (!take) continue
      inventory[plate.id] -= take
      if (!inventory[plate.id]) delete inventory[plate.id]
      remaining -= take
      if (!remaining) break
    }
    const rewardPool = platesOfRarity(target)
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)]
    if (!reward) return false
    inventory[reward.id] = (inventory[reward.id] ?? 0) + 1
    apply({ ...current, inventory, synced: false })
    return true
  }, [apply, refresh])

  return { state, addDrop, applyUpgrade, refresh, error }
}
