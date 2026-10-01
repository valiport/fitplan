// Gewichts-Chart (Pro): Berechnung der Verlaufskurve als normierte Punkte
// (320×120) mit linearer Trend-Prognose, plus PNG-Export über Canvas.
// Einmal berechnet, zweimal genutzt: SVG-Anzeige (ProgressPanel) und Download.

import type { WeightEntry } from './types'

export const CHART_WIDTH = 320
export const CHART_HEIGHT = 120
const PAD_TOP = 12
const PAD_BOTTOM = 8

export interface ChartForecast {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface WeightChart {
  points: string
  dots: { x: number; y: number }[]
  forecast: ChartForecast | null
  caption: string
}

/**
 * Chart-Daten: normierte Punkte (auf 320×120) + lineare Trend-Prognose
 * über die nächsten 30 Tage.
 */
export function buildChartPlan(entries: WeightEntry[], targetKg: number | null): WeightChart {
  const width = CHART_WIDTH
  const height = CHART_HEIGHT

  if (entries.length === 0) {
    return { points: '', dots: [], forecast: null, caption: 'Trage zuerst ein Gewicht ein.' }
  }

  const values = entries.map((e) => e.kg)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (targetKg !== null) {
    min = Math.min(min, targetKg)
    max = Math.max(max, targetKg)
  }
  const span = Math.max(0.5, max - min)
  const y = (kg: number) => PAD_TOP + (1 - (kg - min) / span) * (height - PAD_TOP - PAD_BOTTOM)

  // Zeitachse: Tage seit dem ersten Eintrag (chronologisch sortiert).
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const firstTime = new Date(sorted[0].date).getTime()
  const days = sorted.map((e) => (new Date(e.date).getTime() - firstTime) / 86_400_000)
  const maxDay = Math.max(...days, 1)
  const x = (d: number) => 8 + (d / maxDay) * (width - 16)

  const dots = sorted.map((e, i) => ({ x: x(days[i]), y: y(e.kg) }))
  const points = dots.map((d) => `${d.x.toFixed(1)},${d.y.toFixed(1)}`).join(' ')

  // Lineare Regression über (Tag, kg) → Prognose für +30 Tage.
  const n = sorted.length
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sx += days[i]
    sy += values[i]
    sxx += days[i] * days[i]
    sxy += days[i] * values[i]
  }
  const denom = n * sxx - sx * sx
  let forecast: ChartForecast | null = null
  let caption = 'Noch zu wenige Einträge für einen Trend.'
  if (n >= 2 && denom !== 0) {
    const slope = (n * sxy - sx * sy) / denom
    const intercept = (sy - slope * sx) / n
    const lastDay = days[n - 1]
    const futureDay = lastDay + 30
    forecast = {
      x1: x(lastDay),
      y1: y(intercept + slope * lastDay),
      x2: x(futureDay),
      y2: y(intercept + slope * futureDay),
    }
    const weekRate = slope * 7
    caption =
      Math.abs(slope) < 0.005
        ? 'Dein Gewicht ist aktuell stabil.'
        : `Trend: ${weekRate > 0 ? '+' : ''}${weekRate.toFixed(2)} kg/Woche · Prognose gestrichelt (30 Tage).`
    if (targetKg !== null && slope < 0) {
      const daysToTarget = (targetKg - (intercept + slope * lastDay)) / slope
      if (daysToTarget > 0 && Number.isFinite(daysToTarget)) {
        caption += ` Ziel in ca. ${Math.round(daysToTarget)} Tagen.`
      }
    }
  }

  return { points, dots, forecast, caption }
}

/** Zeichnet Chart + Beschriftung auf ein Canvas (2× für scharfe PNGs). */
function drawChartCanvas(chart: WeightChart): HTMLCanvasElement {
  const scale = 2
  const width = CHART_WIDTH * scale
  const height = (CHART_HEIGHT + 34) * scale // Chart + Titel + Caption
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const offsetX = 8 * scale
  const offsetY = 26 * scale // Platz für Titel

  // Hintergrund im App-Look
  ctx.fillStyle = '#0a1a17'
  ctx.fillRect(0, 0, width, height)

  // Titel
  ctx.fillStyle = '#dff4f0'
  ctx.font = `bold ${12 * scale}px 'Segoe UI', system-ui, sans-serif`
  ctx.fillText('FitPlan – Gewichtsverlauf', 8 * scale, 16 * scale)

  // Rasterlinien
  ctx.strokeStyle = 'rgba(235,255,251,0.12)'
  ctx.setLineDash([3 * scale, 4 * scale])
  ;[0.25, 0.5, 0.75].forEach((f) => {
    const gy = offsetY + f * (CHART_HEIGHT - PAD_TOP - PAD_BOTTOM) * scale
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(width, gy)
    ctx.stroke()
  })
  ctx.setLineDash([])

  // Verlaufslinie
  if (chart.points) {
    ctx.strokeStyle = '#5fe3d4'
    ctx.lineWidth = 2 * scale
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    chart.points.split(' ').forEach((pair, i) => {
      const [px, py] = pair.split(',').map(Number)
      const cx = offsetX + px * scale
      const cy = offsetY + py * scale
      if (i === 0) ctx.moveTo(cx, cy)
      else ctx.lineTo(cx, cy)
    })
    ctx.stroke()

    // Punkte
    chart.dots.forEach((d) => {
      ctx.beginPath()
      ctx.arc(offsetX + d.x * scale, offsetY + d.y * scale, 2.5 * scale, 0, Math.PI * 2)
      ctx.fillStyle = '#0a1a17'
      ctx.fill()
      ctx.strokeStyle = '#5fe3d4'
      ctx.lineWidth = 1.5 * scale
      ctx.stroke()
    })
  }

  // Prognose gestrichelt
  if (chart.forecast) {
    ctx.strokeStyle = '#ffcf7e'
    ctx.lineWidth = 1.5 * scale
    ctx.setLineDash([4 * scale, 4 * scale])
    ctx.beginPath()
    ctx.moveTo(offsetX + chart.forecast.x1 * scale, offsetY + chart.forecast.y1 * scale)
    ctx.lineTo(offsetX + chart.forecast.x2 * scale, offsetY + chart.forecast.y2 * scale)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Caption
  ctx.fillStyle = '#9fb9b4'
  ctx.font = `${10 * scale}px 'Segoe UI', system-ui, sans-serif`
  ctx.fillText(chart.caption, 8 * scale, offsetY + CHART_HEIGHT * scale + 12 * scale)

  return canvas
}

/** Baut das Chart- PNG und stößt den Download an. */
export function downloadWeightChart(entries: WeightEntry[], caption: string): void {
  const chart = buildChartPlan(entries, profileTargetGuess(entries))
  const canvas = drawChartCanvas({ ...chart, caption })
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fitplan-gewichtsverlauf-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}

/** Zielgewicht-Schätzung: erstes erfasstes Gewicht minus 10 % (Abnahme-Richtung). */
export function profileTargetGuess(entries: WeightEntry[]): number | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const oldest = sorted[0]
  return oldest && oldest.kg > 0 ? oldest.kg * 0.9 : null
}
