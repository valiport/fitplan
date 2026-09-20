// Profil im Browser speichern (localStorage) mit Form-Validierung.

import { useCallback, useState } from 'react'
import { loadJson, removeKey, saveJson } from '../domain/storage'
import type { Diet, Goal, Profile, Sport } from '../domain/types'

const KEY = 'fitplanner.profile.v1'

const SPORTS: Sport[] = ['running', 'cycling', 'strength', 'team', 'combat']
const GOALS: Goal[] = ['lose', 'maintain', 'gain']
const DIETS: Diet[] = ['omnivore', 'vegetarian', 'vegan']

export function parseProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null) return null
  const v = raw as Record<string, unknown>
  if (
    !SPORTS.includes(v.sport as Sport) ||
    !GOALS.includes(v.goal as Goal) ||
    !DIETS.includes(v.diet as Diet) ||
    (v.sex !== 'male' && v.sex !== 'female') ||
    typeof v.age !== 'number' ||
    typeof v.heightCm !== 'number' ||
    typeof v.weightKg !== 'number' ||
    typeof v.trainingDays !== 'number' ||
    v.age < 14 ||
    v.age > 90 ||
    v.heightCm < 120 ||
    v.heightCm > 230 ||
    v.weightKg < 35 ||
    v.weightKg > 250 ||
    v.trainingDays < 1 ||
    v.trainingDays > 6 ||
    !Number.isInteger(v.trainingDays)
  ) {
    return null
  }
  return {
    sport: v.sport as Sport,
    goal: v.goal as Goal,
    diet: v.diet as Diet,
    sex: v.sex,
    age: v.age,
    heightCm: v.heightCm,
    weightKg: v.weightKg,
    trainingDays: v.trainingDays,
  }
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(() => loadJson(KEY, parseProfile))

  const save = useCallback((p: Profile) => {
    const ok = saveJson(KEY, p)
    if (ok) setProfile(p)
    return ok
  }, [])

  const clear = useCallback(() => {
    removeKey(KEY)
    setProfile(null)
  }, [])

  return { profile, save, clear }
}
