// Kleine Datum-Helfer. Wochen laufen Montag..Sonntag.

/** Montag der Woche, die `d` enthält, um Mitternacht lokaler Zeit. */
export function startOfWeek(d: Date = new Date()): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (r.getDay() + 6) % 7 // Mo=0..So=6
  r.setDate(r.getDate() - shift)
  return r
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Lokales ISO-Datum (YYYY-MM-DD), ohne UTC-Verschiebung. */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Striktes Parsing eines ISO-Datums in lokaler Zeit; ungültige Tage werden abgewiesen. */
export function parseISODate(s: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export function formatKg(n: number): string {
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`
}

export function formatKcal(n: number): string {
  return `${Math.round(n).toLocaleString('de-DE')} kcal`
}
