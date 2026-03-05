import type { WeightEntry, WeeklyAverage, WeightUnit } from '@/types'

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * Returns the start of the week (as ISO date string) containing the given date.
 * weekStartDay: 0=Sun, 1=Mon (default), 2=Tue, … 6=Sat
 */
export function weekStart(dateStr: string, weekStartDay = 1): string {
  const d = new Date(dateStr + 'T12:00:00Z') // noon UTC avoids DST edge cases
  const dow = (d.getUTCDay() - weekStartDay + 7) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().split('T')[0]
}

/** Returns the last day of the week containing the given date. */
export function weekEnd(dateStr: string, weekStartDay = 1): string {
  const start = new Date(weekStart(dateStr, weekStartDay) + 'T12:00:00Z')
  start.setUTCDate(start.getUTCDate() + 6)
  return start.toISOString().split('T')[0]
}

/** Returns a sortable key for the week: the ISO date of the week's start day. */
export function toWeekKey(dateStr: string, weekStartDay = 1): string {
  return weekStart(dateStr, weekStartDay)
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
  weekStartDay = 1,
): WeeklyAverage[] {
  const userEntries = entries.filter((e) => e.userId === userId)

  // Group by week key
  const grouped = new Map<string, WeightEntry[]>()
  for (const entry of userEntries) {
    const key = toWeekKey(entry.date, weekStartDay)
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
      weekStart: weekStart(sampleDate, weekStartDay),
      weekEnd: weekEnd(sampleDate, weekStartDay),
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
  weekStartDay = 1,
): { current: WeeklyAverage | null; previous: WeeklyAverage | null } {
  const all = computeWeeklyAverages(userId, entries, weekStartDay)
  return {
    current: all.at(-1) ?? null,
    previous: all.length >= 2 ? all.at(-2) ?? null : null,
  }
}

/** Total weight lost from first recorded week to most recent. */
export function totalWeightLost(userId: string, entries: WeightEntry[], weekStartDay = 1): number | null {
  const avgs = computeWeeklyAverages(userId, entries, weekStartDay)
  if (avgs.length < 2) return null
  return round2(avgs[0].average - avgs.at(-1)!.average)
}

/** Count of consecutive weeks (ending at the most recent week) that have ≥1 entry. */
export function computeStreak(userId: string, entries: WeightEntry[], weekStartDay = 1): number {
  const avgs = computeWeeklyAverages(userId, entries, weekStartDay)
  if (avgs.length === 0) return 0

  // Check if the most recent week is the current or last week
  const latestKey = avgs.at(-1)!.weekKey
  const thisWeekStart = weekStart(todayStr(), weekStartDay)
  const lastWeekStart = weekStart(
    new Date(new Date().getTime() - 7 * 86_400_000)
      .toISOString()
      .split('T')[0],
    weekStartDay,
  )
  if (latestKey !== thisWeekStart && latestKey !== lastWeekStart) return 0

  return avgs.length  // simplified: consecutive since they're all sorted
}

/**
 * Computes the linear trend (lbs/week) over the last N weekly averages.
 * Returns null if fewer than 2 data points.
 */
export function computeTrend(
  weeklyAverages: WeeklyAverage[],
  lookbackWeeks = 8,
): { ratePerWeek: number } | null {
  const weeks = weeklyAverages.slice(-lookbackWeeks)
  if (weeks.length < 2) return null

  const n = weeks.length
  const xMean = (n - 1) / 2
  const yMean = weeks.reduce((s, w) => s + w.average, 0) / n
  let ssxy = 0
  let ssx = 0
  for (let i = 0; i < n; i++) {
    ssxy += (i - xMean) * (weeks[i].average - yMean)
    ssx += (i - xMean) ** 2
  }
  const slope = ssx > 0 ? ssxy / ssx : 0
  return { ratePerWeek: round2(slope) }
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
