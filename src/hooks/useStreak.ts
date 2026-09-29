// Streak & Tages-Fortschritt: ein Streak-Tag zählt, sobald mindestens ein
// geplanter Punkt erledigt ist; unvollständige Tage brechen ihn nicht. Der
// heutige Tag darf offen sein, damit man den Streak tagsüber nicht verliert.

import { addDays, startOfWeek, toISODate } from '../domain/dates'
import type { DayPlan } from '../domain/types'

/** Abhakbare IDs eines Tages (Training + Mahlzeiten), konsistent mit DayView. */
export function dayCheckIds(dayIndex: number, day: DayPlan): string[] {
  const ids = [`d${dayIndex}-workout-0`]
  day.meals.forEach((_, i) => ids.push(`d${dayIndex}-meal-${i}`))
  return ids
}

export interface DayProgress {
  done: number
  total: number
  complete: boolean
}

export function dayProgress(dayIndex: number, day: DayPlan, checked: Set<string>): DayProgress {
  const ids = dayCheckIds(dayIndex, day)
  const done = ids.filter((id) => checked.has(id)).length
  return { done, total: ids.length, complete: ids.length > 0 && done === ids.length }
}

export interface StreakInfo {
  streak: number
  /** 28 Tage rückwärts (4 Wochen, ältester zuerst): Datum + Fortschritt. */
  days: { date: string; weekday: number; progress: DayProgress }[]
}

/**
 * Berechnet Streak & Tagesfortschritte über die letzten 4 Wochen. Die Checks
 * liegen pro Woche im localStorage (`fitplanner.checks.<weekStart>`), deshalb
 * bekommt die Funktion einen Reader und den Tagesraster des aktuellen Plans.
 */
export function computeStreak(
  planDays: DayPlan[],
  readChecks: (weekStartISO: string) => Set<string>,
): StreakInfo {
  const thisWeek = startOfWeek()
  const days: StreakInfo['days'] = []
  const checksByWeek = new Map<string, Set<string>>()
  const checksFor = (weekStart: Date) => {
    const key = toISODate(weekStart)
    let checks = checksByWeek.get(key)
    if (!checks) {
      checks = readChecks(key)
      checksByWeek.set(key, checks)
    }
    return checks
  }

  for (let w = 3; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w)
    const checks = checksFor(start)
    planDays.forEach((day, i) => {
      days.push({ date: toISODate(addDays(start, i)), weekday: i, progress: dayProgress(i, day, checks) })
    })
  }

  // Streak nicht auf die 28 Tage im Fortschrittsverlauf begrenzen: Checks
  // bleiben wochenweise gespeichert, daher die aktuelle Serie bis zum ersten
  // inaktiven Tag zurückverfolgen. Heute darf noch offen sein.
  const today = new Date()
  const todayIndex = (today.getDay() + 6) % 7
  const todayChecks = checksFor(startOfWeek(today))
  const todayProgress = planDays[todayIndex]
    ? dayProgress(todayIndex, planDays[todayIndex], todayChecks)
    : { done: 0, total: 0, complete: false }
  let streak = 0
  const firstOffset = todayProgress.done > 0 ? 0 : 1
  for (let offset = firstOffset; offset < 36_500; offset++) {
    const date = addDays(today, -offset)
    const weekday = (date.getDay() + 6) % 7
    const day = planDays[weekday]
    if (!day || dayProgress(weekday, day, checksFor(startOfWeek(date))).done === 0) break
    streak++
  }
  return { streak, days }
}
