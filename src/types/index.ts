// ─── Core Domain Types ──────────────────────────────────────────────────────

export type WeightUnit = 'lbs'
export type Gender = 'male' | 'female' | 'other'

export const AVAILABLE_EMOJIS = ['🦁', '🐻', '🦊', '🐺', '🦅', '🐸', '🦜', '🦝'] as const
export type UserEmoji = (typeof AVAILABLE_EMOJIS)[number]

export interface User {
  id: string
  name: string
  emoji: UserEmoji
  unit: WeightUnit
  startingWeight: number | null
  goalWeight: number | null
  heightIn: number | null   // total height in inches, e.g. 70 = 5ft 10in
  gender: Gender | null
  createdAt: string
}

export interface WeightEntry {
  id: string
  userId: string
  weight: number
  date: string        // ISO date string, e.g. "2026-03-04"
  note: string | null
  createdAt: string
}

// ─── Computed / Derived Types ────────────────────────────────────────────────

export interface WeeklyAverage {
  userId: string
  weekKey: string     // "YYYY-Www" e.g. "2026-W10"
  weekStart: string   // ISO date of Monday
  weekEnd: string     // ISO date of Sunday
  average: number
  entryCount: number
  delta: number | null  // change vs previous week (null if no prior week)
}

// ─── Store State Types ───────────────────────────────────────────────────────

export interface AppState {
  activeUserId: string | null
  users: User[]
  entries: WeightEntry[]
}
