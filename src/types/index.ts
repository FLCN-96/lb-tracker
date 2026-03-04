// ─── Core Domain Types ──────────────────────────────────────────────────────

export type WeightUnit = 'lbs' | 'kg'

export interface User {
  id: string
  name: string
  unit: WeightUnit
  startingWeight: number | null
  goalWeight: number | null
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

export interface UserProgress {
  user: User
  currentWeekAvg: WeightlyAvg | null
  previousWeekAvg: WeightlyAvg | null
  totalLost: number | null
  weeksActive: number
  streak: number       // consecutive weeks with at least 1 entry
}

// Small alias used inside UserProgress to avoid forward-reference issues
type WeightlyAvg = Omit<WeeklyAverage, 'userId'>

export interface GroupSummary {
  weekKey: string
  weekStart: string
  weekEnd: string
  members: Array<{
    user: User
    average: number | null
    delta: number | null
  }>
}

// ─── Store State Types ───────────────────────────────────────────────────────

export interface AppState {
  activeUserId: string | null
  users: User[]
  entries: WeightEntry[]
}
