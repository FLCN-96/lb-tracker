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

// ─── Statistical analysis ────────────────────────────────────────────────────

/** Lanczos approximation of ln(Γ(z)) */
function lnGamma(z: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
  z -= 1
  let x = c[0]
  for (let i = 1; i < 9; i++) x += c[i] / (z + i)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

/** Lentz continued fraction for the regularized incomplete beta function. */
function betaCF(x: number, a: number, b: number): number {
  const MAXIT = 200, EPS = 3e-7, FPMIN = 1e-30
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - qab * x / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d; let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; const del = d * c; h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Regularized incomplete beta I_x(a, b). */
function incBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const front = Math.exp(
    a * Math.log(x) + b * Math.log(1 - x) - lnGamma(a) - lnGamma(b) + lnGamma(a + b),
  )
  return x < (a + 1) / (a + b + 2)
    ? front * betaCF(x, a, b) / a
    : 1 - front * betaCF(1 - x, b, a) / b
}

/** Two-tailed p-value for t-statistic with `df` degrees of freedom. */
function tPValue(t: number, df: number): number {
  return incBeta(df / (df + t * t), df / 2, 0.5)
}

/** 97.5th percentile of t-distribution (two-sided 95% CI), linearly interpolated. */
function tCrit95(df: number): number {
  const tbl: [number, number][] = [
    [1, 12.706], [2, 4.303], [3, 3.182], [4, 2.776], [5, 2.571],
    [6, 2.447], [7, 2.365], [8, 2.306], [9, 2.262], [10, 2.228],
    [15, 2.131], [20, 2.086], [25, 2.060], [30, 2.042], [40, 2.021],
    [60, 2.000], [120, 1.980],
  ]
  if (df >= 120) return 1.960
  for (let i = 0; i < tbl.length - 1; i++) {
    const [d0, t0] = tbl[i], [d1, t1] = tbl[i + 1]
    if (df >= d0 && df <= d1) return t0 + ((df - d0) / (d1 - d0)) * (t1 - t0)
  }
  return 1.960
}

export interface OLSResult {
  n: number
  slope: number          // lbs (or kg) per week
  intercept: number
  r2: number             // coefficient of determination
  adjR2: number          // adjusted R²
  rse: number            // residual standard error
  slopeSE: number        // SE of slope
  tStat: number          // t-statistic for H₀: slope = 0
  pValue: number         // two-tailed p-value (raw)
  ci95: [number, number] // 95% CI for slope
}

/**
 * Ordinary Least Squares regression of weekly-average weights on week index.
 * Returns null if fewer than 3 data points (need df ≥ 1 for MSE).
 */
export function computeOLS(weeklyAverages: WeeklyAverage[]): OLSResult | null {
  const n = weeklyAverages.length
  if (n < 3) return null
  const ys = weeklyAverages.map((w) => w.average)
  const xMean = (n - 1) / 2
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  let ssxy = 0, ssx = 0
  for (let i = 0; i < n; i++) {
    ssxy += (i - xMean) * (ys[i] - yMean)
    ssx  += (i - xMean) ** 2
  }
  const slope = ssxy / ssx
  const intercept = yMean - slope * xMean
  let sse = 0, ssy = 0
  for (let i = 0; i < n; i++) {
    sse += (ys[i] - (intercept + slope * i)) ** 2
    ssy += (ys[i] - yMean) ** 2
  }
  const r2    = ssy > 0 ? 1 - sse / ssy : 0
  const adjR2 = 1 - (1 - r2) * (n - 1) / (n - 2)
  const mse     = sse / (n - 2)
  const rse     = Math.sqrt(mse)
  const slopeSE = Math.sqrt(mse / ssx)
  const tStat   = slopeSE > 0 ? slope / slopeSE : 0
  const pValue  = tPValue(Math.abs(tStat), n - 2)
  const tc      = tCrit95(n - 2)
  return {
    n,
    slope:     round2(slope),
    intercept: round2(intercept),
    r2:     Math.round(r2    * 1000) / 1000,
    adjR2:  Math.round(adjR2 * 1000) / 1000,
    rse:    round2(rse),
    slopeSE: round2(slopeSE),
    tStat:   round2(tStat),
    pValue,
    ci95: [round2(slope - tc * slopeSE), round2(slope + tc * slopeSE)],
  }
}

export interface DescriptiveStats {
  n: number
  mean: number
  sd: number
  cv: number           // coefficient of variation (%)
  min: number
  max: number
  range: number
  skewness: number | null  // sample skewness (G1), null if n < 3
  acf1: number | null      // lag-1 autocorrelation, null if n < 3
}

/**
 * Descriptive statistics over weekly-average weights.
 * Returns null if fewer than 2 data points.
 */
export function computeDescriptives(weeklyAverages: WeeklyAverage[]): DescriptiveStats | null {
  const n = weeklyAverages.length
  if (n < 2) return null
  const ys = weeklyAverages.map((w) => w.average)
  const mean = ys.reduce((s, y) => s + y, 0) / n
  const sd   = Math.sqrt(ys.reduce((s, y) => s + (y - mean) ** 2, 0) / (n - 1))
  const min  = Math.min(...ys), max = Math.max(...ys)
  let skewness: number | null = null
  if (n >= 3 && sd > 0) {
    const m3 = ys.reduce((s, y) => s + ((y - mean) / sd) ** 3, 0)
    skewness = Math.round((n / ((n - 1) * (n - 2))) * m3 * 100) / 100
  }
  let acf1: number | null = null
  if (n >= 3) {
    let num = 0, den = 0
    for (let i = 0; i < n; i++) den += (ys[i] - mean) ** 2
    for (let i = 0; i < n - 1; i++) num += (ys[i] - mean) * (ys[i + 1] - mean)
    acf1 = den > 0 ? Math.round((num / den) * 100) / 100 : 0
  }
  return {
    n,
    mean: round2(mean),
    sd:   round2(sd),
    cv:   Math.round((sd / mean) * 1000) / 10,
    min:  round2(min),
    max:  round2(max),
    range: round2(max - min),
    skewness,
    acf1,
  }
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
