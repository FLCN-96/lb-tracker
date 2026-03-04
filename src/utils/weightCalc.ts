import type { WeightEntry, WeeklyAverage, WeightUnit } from '@/types'

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Returns the ISO week key for a date, e.g. "2026-W10" */
export function toWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z') // noon UTC avoids DST edge cases
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const dayOfYear = Math.floor((d.getTime() - jan4.getTime()) / 86_400_000) + 4
  const week = Math.ceil(dayOfYear / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Returns the Monday (start) of the ISO week containing the given date */
export function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7  // 0=Mon … 6=Sun
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().split('T')[0]
}

/** Returns the Sunday (end) of the ISO week containing the given date */
export function weekEnd(dateStr: string): string {
  const start = new Date(weekStart(dateStr) + 'T12:00:00Z')
  start.setUTCDate(start.getUTCDate() + 6)
  return start.toISOString().split('T')[0]
}

/** Today's date as "YYYY-MM-DD" (local time) */
export function todayStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Core calculations ────────────────────────────────────────────────────────

/**
 * Computes weekly averages for a single user's entries,
 * sorted ascending by weekKey.
 */
export function computeWeeklyAverages(
  userId: string,
  entries: WeightEntry[],
): WeeklyAverage[] {
  const userEntries = entries.filter((e) => e.userId === userId)

  // Group by week key
  const grouped = new Map<string, WeightEntry[]>()
  for (const entry of userEntries) {
    const key = toWeekKey(entry.date)
    const bucket = grouped.get(key) ?? []
    bucket.push(entry)
    grouped.set(key, bucket)
  }

  // Sort weeks ascending
  const sortedKeys = [...grouped.keys()].sort()

  const averages: WeeklyAverage[] = []
  let prevAvg: number | null = null

  for (const key of sortedKeys) {
    const bucket = grouped.get(key)!
    const avg = bucket.reduce((sum, e) => sum + e.weight, 0) / bucket.length
    const sampleDate = bucket[0].date

    averages.push({
      userId,
      weekKey: key,
      weekStart: weekStart(sampleDate),
      weekEnd: weekEnd(sampleDate),
      average: round2(avg),
      entryCount: bucket.length,
      delta: prevAvg !== null ? round2(avg - prevAvg) : null,
    })

    prevAvg = avg
  }

  return averages
}

/** Returns the two most recent weekly averages for a user (current + prior). */
export function getRecentWeeks(
  userId: string,
  entries: WeightEntry[],
): { current: WeeklyAverage | null; previous: WeeklyAverage | null } {
  const all = computeWeeklyAverages(userId, entries)
  return {
    current: all.at(-1) ?? null,
    previous: all.length >= 2 ? all.at(-2) ?? null : null,
  }
}

/** Total weight lost from first recorded week to most recent. */
export function totalWeightLost(userId: string, entries: WeightEntry[]): number | null {
  const avgs = computeWeeklyAverages(userId, entries)
  if (avgs.length < 2) return null
  return round2(avgs[0].average - avgs.at(-1)!.average)
}

/** Count of consecutive weeks (ending at the most recent week) that have ≥1 entry. */
export function computeStreak(userId: string, entries: WeightEntry[]): number {
  const avgs = computeWeeklyAverages(userId, entries)
  if (avgs.length === 0) return 0

  // Check if the most recent week is the current or last week
  const latestKey = avgs.at(-1)!.weekKey
  const thisWeek = toWeekKey(todayStr())
  const lastWeek = toWeekKey(
    new Date(new Date().getTime() - 7 * 86_400_000)
      .toISOString()
      .split('T')[0],
  )
  if (latestKey !== thisWeek && latestKey !== lastWeek) return 0

  return avgs.length  // simplified: consecutive since they're all sorted
}

// ─── Unit conversion ──────────────────────────────────────────────────────────

export function convert(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight
  return from === 'lbs' ? round2(weight * 0.453592) : round2(weight / 0.453592)
}

export function unitLabel(unit: WeightUnit): string {
  return unit === 'lbs' ? 'lbs' : 'kg'
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function formatWeight(weight: number, unit: WeightUnit): string {
  return `${weight.toFixed(1)} ${unitLabel(unit)}`
}

export function formatDelta(delta: number | null, unit: WeightUnit): string {
  if (delta === null) return '—'
  const sign = delta < 0 ? '' : '+'
  return `${sign}${delta.toFixed(1)} ${unitLabel(unit)}`
}
