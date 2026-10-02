// Geteilter Supabase-Doppel für Cloud-Tests: Ergebnisse werden pro Tabelle in
// eine Queue gelegt und beim jeweiligen from()-Aufruf abgezogen. Select-Ketten
// und Schreib-Ketten (upsert/delete/update/insert) haben getrennte Queues,
// damit Race-Tests Fetch und Schreibzugriff deterministisch verkettet auflösen
// können (Deferred-Promise in die Select-Queue legen). rpc/channel sind Spies,
// damit die Tests die RPC-Verträge (Name + Argumente) exakt sichern.

import { vi } from 'vitest'

export interface SupabaseQueryResult {
  data: unknown
  error: { message: string } | null
}

/** Ergebnis oder Promise darauf — für kontrollierbare Rennsituationen. */
export type QueuedResult = SupabaseQueryResult | Promise<SupabaseQueryResult>

const queues = new Map<string, QueuedResult[]>()
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

function push(table: string, result: QueuedResult): void {
  const list = queues.get(table) ?? []
  list.push(result)
  queues.set(table, list)
}

/** Ergebnis für die nächste SELECT-Abfrage auf `table`. */
export function queueResult(table: string, result: QueuedResult): void {
  push(table, result)
}

/** Ergebnis für die nächste Schreibabfrage (upsert/delete/update/insert). */
export function queueMutation(table: string, result: QueuedResult): void {
  push(`${table}::write`, result)
}

export const supabaseRpc = vi.fn()
export const supabaseChannel = vi.fn()
export const supabaseStorageSignedUrls = vi.fn(async () => ({ data: [], error: null }))
export const supabaseStorageRemove = vi.fn(async () => ({ error: null }))

const channel: any = {}
channel.on = (_type: unknown, _filter: unknown, handler: unknown) => {
  channel.handler = handler
  return channel
}
channel.subscribe = (statusCallback?: unknown) => {
  channel.statusCallback = statusCallback
  return channel
}

/** Realtime-Ereignis an den zuletzt registrierten postgres_changes-Handler. */
export function emitRealtimeChange(payload: unknown): void {
  channel.handler?.(payload)
}

/** Subscribe-Status (z. B. 'SUBSCRIBED') an den zuletzt registrierten Callback. */
export function emitSubscribeStatus(status: string): void {
  channel.statusCallback?.(status)
}

/** Vor jedem Test aufrufen: leert Queues und setzt Standard-Antworten. */
export function clearSupabaseMock(): void {
  queues.clear()
  callLog.length = 0
  channel.handler = undefined
  channel.statusCallback = undefined
  supabaseRpc.mockReset()
  supabaseRpc.mockResolvedValue({ data: null, error: null })
  supabaseChannel.mockReset()
  supabaseChannel.mockImplementation(() => channel)
  supabaseStorageSignedUrls.mockClear()
  supabaseStorageRemove.mockClear()
}

function nextResult(key: string): QueuedResult {
  const list = queues.get(key)
  if (!list || list.length === 0) return EMPTY
  return list.shift() ?? EMPTY
}

const WRITE_METHODS = new Set(['upsert', 'delete', 'update', 'insert'])

// Kette: select().or().eq() … gibt sich selbst zurück; awaited wird die Kette
// über ein then-Property zum Ergebnis-Promise (Postgrest-Builder-Verhalten).
function makeQuery(table: string): any {
  const query: any = {}
  let write = false
  const route = () => (write ? `${table}::write` : table)
  for (const method of ['select', 'or', 'order', 'limit', 'eq', 'neq', 'in', 'range', 'upsert', 'delete', 'update', 'insert']) {
    query[method] = (...args: unknown[]) => {
      if (WRITE_METHODS.has(method)) write = true
      callLog.push({ table, method, args })
      return query
    }
  }
  query.maybeSingle = () => Promise.resolve(nextResult(route()))
  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(nextResult(route())).then(onFulfilled, onRejected)
  return query
}

export const supabaseMockClient = {
  from: (table: string) => makeQuery(table),
  rpc: supabaseRpc,
  channel: supabaseChannel,
  removeChannel: vi.fn(),
  storage: {
    from: () => ({
      createSignedUrls: supabaseStorageSignedUrls,
      remove: supabaseStorageRemove,
    }),
  },
}
