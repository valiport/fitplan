// ICS-Export (Pro): erzeugt eine Kalenderdatei für die Trainingswoche.
// Hart-/Leicht-Tage werden als Termine (18:00 Uhr, 1 h, lokale Zeit ohne
// Zeitzone — "floating", der Kalender nimmt die Gerätezeit) erzeugt,
// Ruhetage bleiben außen vor. RFC 5545: Escaping + Zeilenfaltung bei 75 Oktetten.

import { addDays, fromISODate } from './dates'
import type { WeekPlan } from './types'

/** Escaped Text nach RFC 5545 (Backslash, Semikolon, Komma, Zeilenumbruch). */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Faltet lange Zeilen bei ~75 Zeichen mit CRLF + Leerzeichen um. */
function foldLine(line: string): string {
  const parts: string[] = []
  let rest = line
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73))
    rest = ' ' + rest.slice(73)
  }
  parts.push(rest)
  return parts.join('\r\n')
}

/** Lokales Datum + feste Uhrzeit als ICS DATE-TIME (floating, keine Zonenangabe). */
function icsDateTime(d: Date, hours: number, minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(hours)}${pad(minutes)}00`
  )
}

export function buildWeekICS(plan: WeekPlan): string {
  const weekStart = fromISODate(plan.weekStart)
  const stamp = icsDateTime(new Date(), 12, 0)

  const events: string[] = []
  plan.days.forEach((day, index) => {
    if (day.kind === 'rest') return
    const date = addDays(weekStart, index)
    const guide = day.workoutGuide
    const descriptionLines = [
      guide?.summary ?? day.workout,
      guide ? `Dauer: ${guide.duration} · Intensität: ${guide.intensity}` : null,
      guide ? 'So geht’s:\n' + guide.howTo.map((s, i) => `${i + 1}. ${s}`).join('\n') : null,
      guide && guide.tips.length > 0 ? 'Tipps:\n' + guide.tips.map((t) => `• ${t}`).join('\n') : null,
    ].filter((line): line is string => line !== null && line.length > 0)

    events.push(
      [
        'BEGIN:VEVENT',
        `UID:${plan.weekStart}-d${index}@fitplan.app`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDateTime(date, 18, 0)}`,
        `DTEND:${icsDateTime(date, 19, 0)}`,
        `SUMMARY:${escapeText(`🏋 ${day.workout}`)}`,
        `DESCRIPTION:${escapeText(descriptionLines.join('\n\n'))}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Training in 30 Minuten',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n'),
    )
  })

  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//FitPlan//Trainingswoche//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:FitPlan – Trainingswoche',
      ...events,
      'END:VCALENDAR',
    ]
      .map(foldLine)
      .join('\r\n') + '\r\n'
  )
}

/** Baut die ICS-Datei und stößt den Download an (Kalender-App öffnet sie). */
export function downloadWeekICS(plan: WeekPlan): void {
  const blob = new Blob([buildWeekICS(plan)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `fitplan-woche-${plan.weekStart}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
