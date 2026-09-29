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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
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
