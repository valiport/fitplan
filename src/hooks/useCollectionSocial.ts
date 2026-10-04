// Soziale Schicht der Sammlung: Freunde, Trades, Marktplatz.
// Mit Supabase: echte Tabellen (market_profiles, friends, trades, listings)
// mit RLS und atomaren SQL-Funktionen. Ohne Supabase: lokale Demo-Modus-
// Fallbacks, damit die UI immer testbar bleibt.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getPlate, MIN_PRICE } from '../domain/plates'
import type { Inventory, Rarity } from '../domain/plates'

// ---------------------------------------------------------------- Freunde

export interface Friend {
  id: string
  name: string
}

export interface FriendRequest {
  id: string
  fromUserId: string
  fromName: string
  toUserId: string
  createdAt: string
}

/**
 * Freundesliste aus `friends`, Namen aus dem separaten öffentlichen Marktprofil.
 * Ohne Cloud: drei Demo-Freunde (nur Oberfläche, keine echten Sozialfunktionen).
 */
export function useFriends(userId: string): {
  friends: Friend[]
  requests: FriendRequest[]
  displayName: string
  setDisplayName: (name: string) => Promise<void>
  loading: boolean
  error: string | null
  sendRequest: (toUserId: string) => Promise<void>
  respondRequest: (requestId: string, accept: boolean) => Promise<void>
  removeFriend: (friendId: string) => Promise<void>
  reload: () => Promise<void>
} {
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [displayName, setDisplayNameState] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setFriends([
        { id: 'demo-friend-1', name: 'Max (Demo)' },
        { id: 'demo-friend-2', name: 'Lena (Demo)' },
        { id: 'demo-friend-3', name: 'Tobi (Demo)' },
      ])
      setRequests([])
      setDisplayNameState('')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error: queryError } = await supabase
        .from('friends')
        .select('id,user_id_a,user_id_b,requested_by,status,created_at')
        .or(`user_id_a.eq.${userId},user_id_b.eq.${userId}`)
      if (queryError) throw queryError
      const rows = (data ?? []) as { id: string; user_id_a: string; user_id_b: string; requested_by: string; status: string; created_at: string }[]
      const accepted = rows.filter((row) => row.status === 'accepted')
      const incomingRequests = rows.filter((row) => row.status === 'pending' && row.requested_by !== userId)
      const otherIds = accepted.map((row) => (row.user_id_a === userId ? row.user_id_b : row.user_id_a))
      const profileIds = [...new Set([userId, ...otherIds, ...incomingRequests.map((row) => row.requested_by)])]
      const { data: profiles, error: profileError } = await supabase
        .from('market_profiles')
        .select('user_id,display_name')
        .in('user_id', profileIds)
      if (profileError) throw profileError
      const names = Object.fromEntries(((profiles ?? []) as { user_id: string; display_name: string }[])
        .map((profile) => [profile.user_id, profile.display_name]))
      setDisplayNameState(names[userId] ?? '')
      setRequests(incomingRequests.map((row) => ({
        id: row.id,
        fromUserId: row.requested_by,
        fromName: names[row.requested_by] ?? `Nutzer ${row.requested_by.slice(0, 6)}`,
        toUserId: userId,
        createdAt: row.created_at,
      })))
      setFriends(otherIds.map((id) => ({
        id,
        name: names[id] ?? `Nutzer ${id.slice(0, 6)}`,
      })))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Freundesliste konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  // Live-Updates: eingehende Anfragen/Antworten des Partners ohne Reload.
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`friends:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_profiles' }, () => { void load() })
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [userId, load])

  const setDisplayName = useCallback(async (name: string) => {
    if (!supabase) throw new Error('Spitznamen speichern benötigt die Cloud.')
    const normalized = name.trim()
    if (normalized.length < 2 || normalized.length > 24 || /[\u0000-\u001f\u007f]/.test(normalized)) {
      throw new Error('Der Spitzname muss 2 bis 24 Zeichen lang sein.')
    }
    const { error: rpcError } = await supabase.rpc('set_market_display_name', { p_display_name: normalized })
    if (rpcError) throw rpcError
    setDisplayNameState(normalized)
    await load()
  }, [load])

  const sendRequest = useCallback(async (toUserId: string) => {
    if (!supabase) throw new Error('Freundschaftsanfragen benötigen die Cloud.')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(toUserId)) {
      throw new Error('Bitte eine gültige Nutzer-UUID eingeben.')
    }
    const { error: rpcError } = await supabase.rpc('send_friend_request', { p_to: toUserId })
    if (rpcError) throw rpcError
    await load()
  }, [load])

  const respondRequest = useCallback(async (requestId: string, accept: boolean) => {
    if (!supabase) throw new Error('Freundschaftsanfragen benötigen die Cloud.')
    const { error: rpcError } = await supabase.rpc('respond_friend_request', { p_friend: requestId, p_accept: accept })
    if (rpcError) throw rpcError
    await load()
  }, [load])

  /** Freundschaft beenden (oder eigene offene Anfrage zurückziehen). */
  const removeFriend = useCallback(async (friendId: string) => {
    if (!supabase) throw new Error('Freundschaft entfernen benötigt die Cloud.')
    const { error: rpcError } = await supabase.rpc('remove_friend', { p_friend: friendId })
    if (rpcError) throw rpcError
    await load()
  }, [load])

  return { friends, requests, displayName, setDisplayName, loading, error, sendRequest, respondRequest, removeFriend, reload: load }
}

// ------------------------------------------------------------------ Trades

export type TradeStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export interface TradeItems {
  /** plateId → Stückzahl */
  [plateId: string]: number
}

export interface Trade {
  id: string
  fromUserId: string
  toUserId: string
  offered: TradeItems
  requested: TradeItems
  status: TradeStatus
  createdAt: string
}

interface TradeRow {
  id: string
  from_user_id: string
  to_user_id: string
  offered_items: TradeItems
  requested_items: TradeItems
  status: TradeStatus
  created_at: string
}

const rowToTrade = (row: TradeRow): Trade => ({
  id: row.id,
  fromUserId: row.from_user_id,
  toUserId: row.to_user_id,
  offered: row.offered_items ?? {},
  requested: row.requested_items ?? {},
  status: row.status,
  createdAt: row.created_at,
})

/** Cooldown zwischen Trade-Aktionen (Missbrauchsschutz). */
const TRADE_COOLDOWN_MS = 30_000
const lastTradeAt = { current: 0 }

export function useTrades(userId: string, friends: Friend[]) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const friendIds = friends.map((f) => f.id).join(',')

  const load = useCallback(async () => {
    if (!supabase) {
      setTrades([])
      setLoading(false)
      return
    }
    try {
      const { data, error: queryError } = await supabase!
        .from('trades')
        .select('id,from_user_id,to_user_id,offered_items,requested_items,status,created_at')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50)
      if (queryError) throw queryError
      setTrades(((data ?? []) as TradeRow[]).map(rowToTrade))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trades konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load, friendIds])

  // Live-Updates: Trade-Antworten des Partners erscheinen ohne Reload.
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`trades:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, () => { void load() })
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [userId, load])

  /** Cooldown-Prüfung + eigener Trade-Call (Cloud-seitig atomar via RPC). */
  const createTrade = useCallback(async (
    toUserId: string,
    offered: TradeItems,
    requested: TradeItems,
  ): Promise<string> => {
    if (Date.now() - lastTradeAt.current < TRADE_COOLDOWN_MS) {
      throw new Error('Kurze Pause: Trades können nur alle 30 Sekunden erstellt werden.')
    }
    const validate = (items: TradeItems): void => {
      const entries = Object.entries(items)
      if (entries.length === 0) throw new Error('Der Tausch muss mindestens eine Platte enthalten.')
      for (const [plateId, qty] of entries) {
        if (!getPlate(plateId)) throw new Error('Unbekannte Platte im Tausch.')
        if (!Number.isInteger(qty) || qty <= 0 || qty > 10) throw new Error('Ungültige Stückzahl (1–10).')
      }
    }
    validate(offered)
    validate(requested)

    if (!supabase) {
      // Demo-Modus: kein toter Pending-Eintrag — ohne Cloud ist kein
      // Partner-Loop (Annehmen/Zurückziehen) möglich, also ehrlich ablehnen.
      throw new Error('Tauschen braucht die Cloud (Demo-Modus: nur Ansehen).')
    }

    const { data, error: rpcError } = await supabase!.rpc('create_trade', {
      p_to: toUserId,
      p_offered: offered,
      p_requested: requested,
    })
    if (rpcError) throw rpcError
    lastTradeAt.current = Date.now()
    const newId = typeof data === 'string' ? data : null
    if (newId) setTrades((previous) => [{
      id: newId,
      fromUserId: userId,
      toUserId,
      offered,
      requested,
      status: 'pending' as TradeStatus,
      createdAt: new Date().toISOString(),
    }, ...previous])
    return newId ?? ''
  }, [userId])

  /** Annehmen/Ablehnen — nur der Empfänger darf das; Cloud prüft atomar. */
  const respondToTrade = useCallback(async (tradeId: string, accept: boolean): Promise<void> => {
    if (!supabase) throw new Error('Tausch-Reaktionen brauchen die Cloud (Demo-Modus nur Anfragen).')
    const { error: rpcError } = await supabase!.rpc('respond_trade', {
      p_trade: tradeId,
      p_accept: accept,
    })
    if (rpcError) throw rpcError
    setTrades((previous) => previous.map((t) => (t.id === tradeId
      ? { ...t, status: (accept ? 'accepted' : 'declined') as TradeStatus }
      : t)))
  }, [])

  /** Eigener Trade zurückziehen (noch pending). */
  const cancelTrade = useCallback(async (tradeId: string): Promise<void> => {
    if (!supabase) {
      setTrades((previous) => previous.filter((t) => t.id !== tradeId))
      return
    }
    const { error: rpcError } = await supabase!.rpc('cancel_trade', { p_trade: tradeId })
    if (rpcError) throw rpcError
    setTrades((previous) => previous.map((t) => (t.id === tradeId
      ? { ...t, status: 'cancelled' as TradeStatus }
      : t)))
  }, [])

  return { trades, loading, error, createTrade, respondToTrade, cancelTrade, reload: load }
}

// -------------------------------------------------------------- Marktplatz

export interface MarketListing {
  id: string
  sellerId: string
  sellerName: string
  plateId: string
  price: number
  status: 'active' | 'sold' | 'removed'
  createdAt: string
}

export interface MarketTransaction {
  id: string
  listingId: string
  plateId: string
  price: number
  /** 'buy' = eingekauft, 'sell' = verkauft. */
  direction: 'buy' | 'sell'
  counterparty: string
  at: string
}

export function useMarket(userId: string, friends: Friend[]) {
  const [listings, setListings] = useState<MarketListing[]>([])
  const [ownListings, setOwnListings] = useState<MarketListing[]>([])
  const [transactions, setTransactions] = useState<MarketTransaction[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState<string | null>(null)
  const friendIds = friends.map((f) => f.id).join(',')

  const load = useCallback(async () => {
    if (!supabase) {
      setListings([])
      setOwnListings([])
      setTransactions([])
      setLoading(false)
      return
    }
    try {
      const { data, error: queryError } = await supabase!
        .from('market_listings')
        .select('id,seller_id,plate_id,price,status,created_at')
        .neq('seller_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50)
      if (queryError) throw queryError
      const rows = (data ?? []) as { id: string; seller_id: string; plate_id: string; price: number; status: 'active' | 'sold' | 'removed'; created_at: string }[]
      const sellerIds = [...new Set(rows.map((r) => r.seller_id))]
      let names: Record<string, string> = {}
      if (sellerIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase!
          .from('market_profiles')
          .select('user_id,display_name')
          .in('user_id', sellerIds)
        if (profileError) throw profileError
        for (const p of ((profiles ?? []) as { user_id: string; display_name: string }[])) {
          names[p.user_id] = p.display_name
        }
      }
      setListings(rows.map((row) => ({
        id: row.id,
        sellerId: row.seller_id,
        sellerName: names[row.seller_id] ?? `Nutzer ${row.seller_id.slice(0, 6)}`,
        plateId: row.plate_id,
        price: row.price,
        status: row.status,
        createdAt: row.created_at,
      })))

      // Eigene aktive Angebote — sonst bleibt eine eingestellte Platte ohne
      // Rückweg im Listing-Zustand gefangen (Reservierung ohne Abbrechen).
      const { data: ownRows, error: ownError } = await supabase!
        .from('market_listings')
        .select('id,seller_id,plate_id,price,status,created_at')
        .eq('seller_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50)
      if (ownError) throw ownError
      setOwnListings(((ownRows ?? []) as { id: string; seller_id: string; plate_id: string; price: number; status: 'active' | 'sold' | 'removed'; created_at: string }[]).map((row) => ({
        id: row.id,
        sellerId: row.seller_id,
        sellerName: 'Du',
        plateId: row.plate_id,
        price: row.price,
        status: row.status,
        createdAt: row.created_at,
      })))

      // Eigene Transaktionen (als Käufer oder Verkäufer).
      const { data: txRows, error: txError } = await supabase!
        .from('market_transactions')
        .select('id,listing_id,plate_id,price,buyer_id,seller_id,created_at')
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50)
      if (txError) throw txError
      setTransactions(((txRows ?? []) as { id: string; listing_id: string; plate_id: string; price: number; buyer_id: string; seller_id: string; created_at: string }[])
        .map((row) => ({
          id: row.id,
          listingId: row.listing_id,
          plateId: row.plate_id,
          price: row.price,
          direction: (row.buyer_id === userId ? 'buy' : 'sell') as 'buy' | 'sell',
          counterparty: row.buyer_id === userId ? row.seller_id : row.buyer_id,
          at: row.created_at,
        })))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Marktplatz konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load, friendIds])

  // Live-Updates: neue/verkaufte Angebote des Marktplatzes ohne Reload.
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`market:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_listings' }, () => { void load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_profiles' }, () => { void load() })
      .subscribe()
    return () => { void supabase?.removeChannel(channel) }
  }, [userId, load])

  /** Eigene Platte zum Verkauf anbieten (Cloud prüft Bestand + Mindestpreis). */
  const createListing = useCallback(async (plateId: string, price: number): Promise<void> => {
    const plate = getPlate(plateId)
    if (!plate) throw new Error('Unbekannte Platte.')
    if (!Number.isInteger(price) || price < MIN_PRICE[plate.rarity]) {
      throw new Error(`Mindestpreis für ${plate.rarity}-Platten: ${MIN_PRICE[plate.rarity]} Coins.`)
    }
    if (!supabase) throw new Error('Verkaufen braucht die Cloud (Demo-Modus: nur Ansehen).')
    const { error: rpcError } = await supabase!.rpc('create_listing', {
      p_plate: plateId,
      p_price: price,
    })
    if (rpcError) throw rpcError
    void load()
  }, [load])

  /** Fremdes Angebot kaufen (Cloud bucht Coins/Inventar atomar). */
  const buyListing = useCallback(async (listingId: string): Promise<void> => {
    if (!supabase) throw new Error('Kaufen braucht die Cloud (Demo-Modus: nur Ansehen).')
    const { error: rpcError } = await supabase!.rpc('buy_listing', { p_listing: listingId })
    if (rpcError) throw rpcError
    void load()
  }, [load])

  /** Eigenes aktives Angebot zurückziehen — Platte geht zurück ins Inventar. */
  const cancelListing = useCallback(async (listingId: string): Promise<void> => {
    if (!supabase) throw new Error('Angebote zurückziehen braucht die Cloud (Demo-Modus: nur Ansehen).')
    const { error: rpcError } = await supabase!.rpc('cancel_listing', { p_listing: listingId })
    if (rpcError) throw rpcError
    void load()
  }, [load])

  return { listings, ownListings, transactions, loading, error, createListing, buyListing, cancelListing, reload: load }
}

/** Demo-Preisrichtwert je Stufe für die UI-Anzeige (falls keine Cloud). */
export function demoMinPrice(rarity: Rarity): number {
  return MIN_PRICE[rarity]
}

/** Typ-Helfer fürs UI. */
export type { Inventory }
