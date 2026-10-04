import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface Database {
  public: {
    Tables: {
      day_checks: {
        Row: { user_id: string; week_start: string; check_id: string; is_checked: boolean; photo_path: string | null; updated_at: string }
        Insert: { user_id: string; week_start: string; check_id: string; is_checked?: boolean; photo_path?: string | null; updated_at?: string }
        Update: { user_id?: string; week_start?: string; check_id?: string; is_checked?: boolean; photo_path?: string | null; updated_at?: string }
        Relationships: []
      }
      user_profiles: {
        Row: { user_id: string; profile_data: unknown; updated_at: string }
        Insert: { user_id: string; profile_data: unknown; updated_at?: string }
        Update: { user_id?: string; profile_data?: unknown; updated_at?: string }
        Relationships: []
      }
      market_profiles: {
        Row: { user_id: string; display_name: string; updated_at: string }
        Insert: { user_id: string; display_name: string; updated_at?: string }
        Update: { user_id?: string; display_name?: string; updated_at?: string }
        Relationships: []
      }
      user_equipment: {
        Row: { user_id: string; sport: string; equipment_data: unknown; updated_at: string }
        Insert: { user_id: string; sport: string; equipment_data: unknown; updated_at?: string }
        Update: { user_id?: string; sport?: string; equipment_data?: unknown; updated_at?: string }
        Relationships: []
      }
      weight_entries: {
        Row: { user_id: string; entry_date: string; kg: number; updated_at: string }
        Insert: { user_id: string; entry_date: string; kg: number; updated_at?: string }
        Update: { user_id?: string; entry_date?: string; kg?: number; updated_at?: string }
        Relationships: []
      }
      subscriptions: {
        Row: { user_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; status: string; price_id: string | null; interval: string | null; current_period_end: string | null; updated_at: string; last_event_at: string | null }
        Insert: { user_id: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; status: string; price_id?: string | null; interval?: string | null; current_period_end?: string | null; updated_at?: string; last_event_at?: string | null }
        Update: { user_id?: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; status?: string; price_id?: string | null; interval?: string | null; current_period_end?: string | null; updated_at?: string; last_event_at?: string | null }
        Relationships: []
      }
      collections: {
        Row: { user_id: string; coins: number; inventory: unknown; updated_at: string }
        Insert: { user_id: string; coins: number; inventory: unknown; updated_at?: string }
        Update: { user_id?: string; coins?: number; inventory?: unknown; updated_at?: string }
        Relationships: []
      }
      friends: {
        Row: { id: string; user_id_a: string; user_id_b: string; requested_by: string; status: string; created_at: string }
        Insert: { id?: string; user_id_a: string; user_id_b: string; requested_by: string; status?: string; created_at?: string }
        Update: { id?: string; user_id_a?: string; user_id_b?: string; requested_by?: string; status?: string; created_at?: string }
        Relationships: []
      }
      trades: {
        Row: { id: string; from_user_id: string; to_user_id: string; offered_items: unknown; requested_items: unknown; status: string; created_at: string }
        Insert: { id?: string; from_user_id: string; to_user_id: string; offered_items: unknown; requested_items: unknown; status?: string; created_at?: string }
        Update: { id?: string; from_user_id?: string; to_user_id?: string; offered_items?: unknown; requested_items?: unknown; status?: string; created_at?: string }
        Relationships: []
      }
      market_listings: {
        Row: { id: string; seller_id: string; plate_id: string; price: number; status: string; created_at: string }
        Insert: { id?: string; seller_id: string; plate_id: string; price: number; status?: string; created_at?: string }
        Update: { id?: string; seller_id?: string; plate_id?: string; price?: number; status?: string; created_at?: string }
        Relationships: []
      }
      market_transactions: {
        Row: { id: string; listing_id: string; plate_id: string; price: number; buyer_id: string; seller_id: string; created_at: string }
        Insert: { id?: string; listing_id: string; plate_id: string; price: number; buyer_id: string; seller_id: string; created_at?: string }
        Update: { id?: string; listing_id?: string; plate_id?: string; price?: number; buyer_id?: string; seller_id?: string; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      set_market_display_name: { Args: { p_display_name: string }; Returns: undefined }
      send_friend_request: { Args: { p_to: string }; Returns: string }
      respond_friend_request: { Args: { p_friend: string; p_accept: boolean }; Returns: undefined }
      remove_friend: { Args: { p_friend: string }; Returns: undefined }
      create_trade: {
        Args: { p_to: string; p_offered: Record<string, number>; p_requested: Record<string, number> }
        Returns: string
      }
      respond_trade: {
        Args: { p_trade: string; p_accept: boolean }
        Returns: undefined
      }
      cancel_trade: {
        Args: { p_trade: string }
        Returns: undefined
      }
      create_listing: {
        Args: { p_plate: string; p_price: number }
        Returns: undefined
      }
      cancel_listing: { Args: { p_listing: string }; Returns: undefined }
      claim_check_reward: { Args: { p_week: string; p_check: string }; Returns: unknown }
      upgrade_collection: { Args: { p_rarity: string }; Returns: string }
      buy_listing: {
        Args: { p_listing: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type FitPlanSupabase = SupabaseClient<Database>

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

let client: FitPlanSupabase | null = null
let configurationError: string | null = null
if (supabaseUrl && supabaseAnonKey) {
  try {
    client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  } catch {
    configurationError = 'Die Supabase-Konfiguration ist ungültig. Bitte URL und öffentlichen Schlüssel prüfen.'
  }
}

export const supabaseConfigured = Boolean(client)
export const supabaseConfigurationError = configurationError
export const supabase = client
/** Basis-URL des Projekts (für direkte XHR-Uploads mit Fortschritt). */
export const supabaseProjectUrl = supabaseUrl ?? null
