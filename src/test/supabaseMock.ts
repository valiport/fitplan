// Geteilter Supabase-Doppel für Cloud-Tests: Ergebnisse werden pro Tabelle in
// eine Queue gelegt und beim jeweiligen from()-Aufruf abgezogen. rpc/channel
// sind Spies, damit die Tests die RPC-Verträge (Name + Argumente) exakt sichern.

import { vi } from 'vitest'

export interface SupabaseQueryResult {
  data: unknown
  error: { message: string } | null
}

const queues = new Map<string, SupabaseQueryResult[]>()
const EMPTY: SupabaseQueryResult = { data: null, error: null }

export interface QueryCall {
  table: string
  method: string
  args: unknown[]
}

const callLog: QueryCall[] = []

/** Aufgerufene Query-Methoden (z. B. eq-Filter) seit dem letzten clear. */
export function queryCalls(table?: string): QueryCall[] {
  return table ? callLog.filter((call) => call.table === table) : callLog
}

export function queueResult(table: string, result: SupabaseQueryResult): void {
  const list = queues.get(table) ?? []
  list.push(result)
  queues.set(table, list)
}

export const supabaseRpc = vi.fn()
export const supabaseChannel = vi.fn()

const channel: any = {}
channel.on = () => channel
channel.subscribe = () => channel

/** Vor jedem Test aufrufen: leert Queues und setzt Standard-Antworten. */
export function clearSupabaseMock(): void {
  queues.clear()
  callLog.length = 0
  supabaseRpc.mockReset()
  supabaseRpc.mockResolvedValue({ data: null, error: null })
  supabaseChannel.mockReset()
  supabaseChannel.mockImplementation(() => channel)
}

function nextResult(table: string): SupabaseQueryResult {
  const list = queues.get(table)
  if (!list || list.length === 0) return EMPTY
  return list.shift() ?? EMPTY
}

// Kette: select().or().eq() … gibt sich selbst zurück; awaited wird die Kette
// über ein then-Property zum Ergebnis-Promise (Postgrest-Builder-Verhalten).
function makeQuery(table: string): any {
  const query: any = {}
  for (const method of ['select', 'or', 'order', 'limit', 'eq', 'neq', 'in']) {
    query[method] = (...args: unknown[]) => {
      callLog.push({ table, method, args })
      return query
    }
  }
  query.maybeSingle = () => Promise.resolve(nextResult(table))
  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(nextResult(table)).then(onFulfilled, onRejected)
  return query
}

export const supabaseMockClient = {
  from: (table: string) => makeQuery(table),
  rpc: supabaseRpc,
  channel: supabaseChannel,
  removeChannel: vi.fn(),
}
