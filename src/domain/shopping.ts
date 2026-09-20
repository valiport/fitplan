// Einkaufsliste: aggregiert alle Zutaten der abgehakt/nicht abgehakten Tage.
// Mengen werden je Einheit sinnvoll summiert (g/ml addieren, Stück ganzzahlig,
// EL/Scheiben ganzzahlig) und in Packungsgrößen gerundet ausgegeben.

import type { Ingredient, WeekPlan } from './types'

export interface ShoppingLine {
  name: string
  /** Summierte Menge. */
  amount: number
  unit: Ingredient['unit']
  /** Gerundete Kaufmenge (Packungslogik), reiner Hinweis fürs Einkaufen. */
  buyAmount: number
}

function roundBuy(amount: number, unit: Ingredient['unit']): number {
  if (unit === 'g') {
    if (amount <= 100) return Math.ceil(amount / 50) * 50
    if (amount <= 500) return Math.ceil(amount / 100) * 100
    return Math.ceil(amount / 500) * 500
  }
  if (unit === 'ml') return Math.ceil(amount / 250) * 250
  return Math.ceil(amount) // Stück/EL/Scheiben
}

/**
 * Aggregiert die Zutaten aller Tage des Wochenplans (Optional nur bestimmter
 * Tage via `include`), gruppiert nach Name+Einheit.
 */
export function buildShoppingList(
  plan: WeekPlan,
  include?: (dayIndex: number) => boolean,
): ShoppingLine[] {
  const totals = new Map<string, ShoppingLine>()
  plan.days.forEach((day, dayIndex) => {
    if (include && !include(dayIndex)) return
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const key = `${item.name}::${item.unit}`
        const existing = totals.get(key)
        if (existing) {
          existing.amount += item.grams
        } else {
          totals.set(key, {
            name: item.name,
            amount: item.grams,
            unit: item.unit,
            buyAmount: 0,
          })
        }
      }
    }
  })
  const lines = [...totals.values()]
  for (const line of lines) line.buyAmount = roundBuy(line.amount, line.unit)
  return lines.sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/** Export als Text (Zwischenablage/Download-Freundlich). */
export function shoppingListToText(lines: ShoppingLine[], title: string): string {
  const head = `Einkaufsliste – ${title}\n${'='.repeat(30)}\n`
  const body = lines
    .map((l) => `- ${l.name}: ${l.amount} ${l.unit} (kaufen: ${l.buyAmount} ${l.unit})`)
    .join('\n')
  return head + body + '\n'
}
