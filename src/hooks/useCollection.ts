// Sammlungs-Zustand: Coins-Wallet + Platten-Inventar.
// Cloud-synchronisiert (Tabelle `collections`); ohne Supabase funktioniert
// alles lokal weiter (Demo-Modus). Eigene Änderungen laufen optimistisch
// lokal und werden hochgeschrieben — Muster wie useWeights.

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadJson, saveJson } from '../domain/storage'
import { supabase } from '../lib/supabase'
import { COINS_PER_CHECK, getPlate, nextRarity, platesOfRarity } from '../domain/plates'
import type { Inventory, Rarity } from '../domain/plates'

const LOCAL_KEY = 'fitplanner.collection.v1'
const cacheKey = (userId: string) => `${LOCAL_KEY}.${userId}`

export interface CollectionState {
  coins: number
  inventory: Inventory
  /** true, sobald die Cloud-Zeile geladen/abgeglichen wurde. */
  synced: boolean
}

function parseCollection(raw: unknown): CollectionState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = raw as Record<string, unknown>
  if (typeof v.coins !== 'number' || !Number.isFinite(v.coins) || v.coins < 0) return null
  if (typeof v.inventory !== 'object' || v.inventory === null) return null
  const inventory: Inventory = {}
  for (const [plateId, qty] of Object.entries(v.inventory as Record<string, unknown>)) {
    if (Number.isInteger(qty) && (qty as number) > 0) inventory[plateId] = qty as number
    else return null
  }
  return { coins: v.coins, inventory, synced: false }
}

const emptyState: CollectionState = { coins: 0, inventory: {}, synced: false }

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

  const persist = useCallback(async (next: CollectionState) => {
    if (!supabase) return
    try {
      const { error: upsertError } = await supabase.from('collections').upsert({
        user_id: userId,
        coins: next.coins,
        inventory: next.inventory,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (upsertError) throw upsertError
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error
        ? `Sammlung konnte nicht synchronisiert werden: ${cause.message}`
        : 'Sammlung konnte nicht synchronisiert werden.')
    }
  }, [userId])

  // Cloud laden. Wallet ist additiv, Inventarzähler nehmen das Maximum —
  // damit können Tausch/Markt (Cloud-seitig) und lokale Drops sich nicht
  // gegenseitig kleinrechnen.
  useEffect(() => {
    if (!supabase) return
    let active = true
    void (async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('collections')
          .select('coins,inventory')
          .eq('user_id', userId)
          .maybeSingle()
        if (!active) return
        if (queryError) throw queryError
        if (data) {
          const cloud = parseCollection({ coins: data.coins, inventory: data.inventory })
          if (cloud) {
            const local = stateRef.current
            const mergedInventory: Inventory = { ...local.inventory }
            for (const [id, qty] of Object.entries(cloud.inventory)) {
              mergedInventory[id] = Math.max(mergedInventory[id] ?? 0, qty)
            }
            apply({
              coins: Math.max(local.coins, cloud.coins),
              inventory: mergedInventory,
              synced: true,
            })
          }
        } else if (stateRef.current.coins > 0 || Object.keys(stateRef.current.inventory).length > 0) {
          // Erster Cloud-Kontakt: lokalen Stand hochladen (best effort).
          await persist(stateRef.current)
        }
        setError(null)
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Sammlung konnte nicht geladen werden.')
      }
    })()
    return () => {
      active = false
    }
  }, [userId, apply, persist])

  /** Drop gutschreiben (nach erledigter Aufgabe): Platte + Coins. */
  const addDrop = useCallback((plateId: string): boolean => {
    const plate = getPlate(plateId)
    if (!plate) return false
    const current = stateRef.current
    apply({
      coins: current.coins + COINS_PER_CHECK,
      inventory: { ...current.inventory, [plateId]: (current.inventory[plateId] ?? 0) + 1 },
      synced: false,
    })
    void persist(stateRef.current)
    return true
  }, [apply, persist])

  /** Coins gutschreiben (z. B. nach Verkauf, Cloud-seitig bereits abgebucht). */
  const creditCoins = useCallback((amount: number): boolean => {
    if (!Number.isFinite(amount) || amount <= 0) return false
    const current = stateRef.current
    apply({ ...current, coins: current.coins + Math.floor(amount), synced: false })
    void persist(stateRef.current)
    return true
  }, [apply, persist])

  /** Coins lokal abziehen (Kauf). false = zu wenig Coins. */
  const spendCoins = useCallback((amount: number): boolean => {
    if (!Number.isFinite(amount) || amount <= 0) return false
    const current = stateRef.current
    if (current.coins < amount) return false
    apply({ ...current, coins: current.coins - Math.floor(amount), synced: false })
    void persist(stateRef.current)
    return true
  }, [apply, persist])

  /** Inventar-Änderung (negativ = abziehen). false, wenn Bestand fehlt. */
  const adjustInventory = useCallback((plateId: string, delta: number): boolean => {
    const current = stateRef.current
    const nextQty = (current.inventory[plateId] ?? 0) + delta
    if (nextQty < 0) return false
    const inventory = { ...current.inventory }
    if (nextQty === 0) delete inventory[plateId]
    else inventory[plateId] = nextQty
    apply({ ...current, inventory, synced: false })
    void persist(stateRef.current)
    return true
  }, [apply, persist])

  /**
   * Upgrade: 3 Platten einer Stufe ( beliebig aus dem Stufen-Pool) →
   * 1 zufällige Platte der nächsten Stufe. false, wenn nicht genug da sind.
   */
  const applyUpgrade = useCallback((rarity: Rarity): boolean => {
    const pool = platesOfRarity(rarity)
    const current = stateRef.current
    const total = pool.reduce((sum, p) => sum + (current.inventory[p.id] ?? 0), 0)
    if (total < 3) return false

    const inventory = { ...current.inventory }
    let remaining = 3
    for (const p of pool) {
      const take = Math.min(inventory[p.id] ?? 0, remaining)
      if (take <= 0) continue
      inventory[p.id] -= take
      if (inventory[p.id] === 0) delete inventory[p.id]
      remaining -= take
      if (remaining === 0) break
    }
    const target = nextRarity(rarity)
    if (!target) return false
    const rewardPool = platesOfRarity(target)
    const reward = rewardPool[Math.floor(Math.random() * rewardPool.length)]
    if (!reward) return false
    inventory[reward.id] = (inventory[reward.id] ?? 0) + 1

    apply({ ...current, inventory, synced: false })
    void persist(stateRef.current)
    return true
  }, [apply, persist])

  return { state, addDrop, creditCoins, spendCoins, adjustInventory, applyUpgrade, error, setError }
}
