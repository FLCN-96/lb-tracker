import { useMemo, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { computeWeeklyAverages } from '@/utils/weightCalc'
import type { User, WeeklyAverage } from '@/types'

const FALLBACK_COLORS = [
  '#4f9cf9', '#f97316', '#a855f7', '#10b981',
  '#ef4444', '#eab308', '#6366f1', '#ec4899',
]

type TimeFrame = 'all' | '1y' | '6m' | '1m'
const TF_OPTIONS: { label: string; value: TimeFrame }[] = [
  { label: 'All', value: 'all' },
  { label: '1Y', value: '1y' },
  { label: '6M', value: '6m' },
  { label: '1M', value: '1m' },
]

type ChartMode = 'absolute' | 'fromStart' | 'fromJoin' | 'weeklyDelta'

const PAD = { top: 24, right: 28, bottom: 28, left: 34 }
const VB_W = 360

interface SeriesData {
  user: User
  color: string
  averages: WeeklyAverage[]
}

interface PlotPoint {
  series: SeriesData
  vals: (number | null)[]
}

// ─── Multi-series chart ───────────────────────────────────────────────────────

function BattleChart({
  series,
  height = 210,
  mode = 'absolute',
}: {
  series: SeriesData[]
  height?: number
  mode?: ChartMode
}) {
  const [frame, setFrame] = useState<TimeFrame>('all')

  const cutoffDate = useMemo((): string | null => {
    if (frame === 'all') return null
    const d = new Date()
    if (frame === '1m') d.setMonth(d.getMonth() - 1)
    else if (frame === '6m') d.setMonth(d.getMonth() - 6)
    else if (frame === '1y') d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().split('T')[0]
  }, [frame])

  // Filter each series to the selected time frame
  const active = useMemo(() => {
    const withData = series.filter((s) => s.averages.length > 0)
    if (!cutoffDate) return withData
    return withData
      .map((s) => ({ ...s, averages: s.averages.filter((a) => a.weekEnd >= cutoffDate) }))
      .filter((s) => s.averages.length > 0)
  }, [series, cutoffDate])

  // Compute x-axis week keys and y-values per series based on mode
  const { allWeekKeys, plotPoints } = useMemo((): { allWeekKeys: string[]; plotPoints: PlotPoint[] } => {
    if (active.length === 0) return { allWeekKeys: [], plotPoints: [] }

    if (mode === 'fromJoin') {
      // Race baseline: the first week of whoever joined latest (within the time frame)
      const raceStart = active.reduce((latest, s) => {
        const first = s.averages[0]?.weekKey ?? ''
        return first > latest ? first : latest
      }, '')

      const filtered = active
        .map((s) => {
          const avgs = s.averages.filter((a) => a.weekKey >= raceStart)
          const baseline = avgs[0]?.average ?? null
          return baseline !== null ? { s, avgs, baseline } : null
        })
        .filter((f): f is { s: SeriesData; avgs: WeeklyAverage[]; baseline: number } => f !== null)

      const allWeekKeys = [
        ...new Set(filtered.flatMap((f) => f.avgs.map((a) => a.weekKey))),
      ].sort()

      const plotPoints: PlotPoint[] = filtered.map(({ s, avgs, baseline }) => {
        const byWeek = new Map(avgs.map((a) => [a.weekKey, a.average]))
        return {
          series: s,
          vals: allWeekKeys.map<number | null>((k) => byWeek.has(k) ? byWeek.get(k)! - baseline : null),
        }
      })

      return { allWeekKeys, plotPoints }
    }

    if (mode === 'weeklyDelta') {
      const allWeekKeys = [
        ...new Set(
          active.flatMap((s) => s.averages.filter((a) => a.delta !== null).map((a) => a.weekKey)),
        ),
      ].sort()

      const plotPoints: PlotPoint[] = active
        .map((s) => {
          const byWeek = new Map(
            s.averages.filter((a) => a.delta !== null).map((a) => [a.weekKey, a.delta!]),
          )
          return {
            series: s,
            vals: allWeekKeys.map<number | null>((k) => byWeek.get(k) ?? null),
          }
        })
        .filter((p) => p.vals.some((v) => v !== null))

      return { allWeekKeys, plotPoints }
    }

    // 'absolute' | 'fromStart'
    const allWeekKeys = [
      ...new Set(active.flatMap((s) => s.averages.map((a) => a.weekKey))),
    ].sort()

    const plotPoints: PlotPoint[] = active.map((s) => {
      const baseline =
        mode === 'fromStart' ? (s.user.startingWeight ?? s.averages[0].average) : 0
      const byWeek = new Map(s.averages.map((a) => [a.weekKey, a.average]))
      return {
        series: s,
        vals: allWeekKeys.map<number | null>((k) =>
          byWeek.has(k) ? byWeek.get(k)! - baseline : null,
        ),
      }
    })

    return { allWeekKeys, plotPoints }
  }, [active, mode])

  const isRelative = mode !== 'absolute'

  const tfBar = (
    <div className="chart-tf-bar">
      {TF_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`chart-tf-btn${frame === opt.value ? ' chart-tf-btn--active' : ''}`}
          onClick={() => setFrame(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  if (plotPoints.length === 0) {
    return (
      <div className="chart-wrap">
        {tfBar}
        <div className="chart-empty">No data in this period</div>
      </div>
    )
  }

  const n = allWeekKeys.length
  const flat = plotPoints.flatMap((p) => p.vals).filter((v): v is number => v !== null)
  if (flat.length === 0) return <div className="chart-empty">No data in this period</div>

  const minV = Math.min(...flat)
  const maxV = Math.max(...flat)
  const rawRange = maxV - minV
  const range = rawRange < 2 ? 4 : rawRange
  const paddedMin = isRelative ? Math.min(minV - range * 0.12, -1) : minV - range * 0.12
  const paddedMax = isRelative ? Math.max(maxV + range * 0.12, 1) : maxV + range * 0.12

  const innerW = VB_W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const toX = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const toY = (v: number) => PAD.top + (1 - (v - paddedMin) / (paddedMax - paddedMin)) * innerH
  const bottomY = PAD.top + innerH

  const yTicks = isRelative
    ? [paddedMax, 0, paddedMin]
    : [paddedMax, (paddedMax + paddedMin) / 2, paddedMin]

  const xLabelIdxs = selectLabelIndices(n, 5)
  const zeroY = isRelative ? toY(0) : null

  return (
    <div className="chart-wrap">
      {tfBar}
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        width="100%"
        height={height}
        overflow="visible"
        role="img"
        aria-label="Comparison chart"
      >
        {/* Grid + Y labels */}
        {yTicks.map((tick, ti) => {
          const y = toY(tick)
          return (
            <g key={ti}>
              <line
                x1={PAD.left} y1={y} x2={VB_W - PAD.right} y2={y}
                stroke="var(--color-border)" strokeWidth="0.8" strokeDasharray="3 4"
              />
              <text
                x={PAD.left - 5} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontSize="9" fill="var(--color-text-muted)" fontFamily="var(--font-sans)"
              >
                {isRelative ? `${tick > 0 ? '+' : ''}${tick.toFixed(0)}` : tick.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Zero reference line for relative charts */}
        {zeroY !== null && (
          <line
            x1={PAD.left} y1={zeroY} x2={VB_W - PAD.right} y2={zeroY}
            stroke="var(--color-text-muted)" strokeWidth="1.5"
            strokeDasharray="5 3" opacity="0.45"
          />
        )}

        {/* X baseline */}
        <line
          x1={PAD.left} y1={bottomY} x2={VB_W - PAD.right} y2={bottomY}
          stroke="var(--color-border)" strokeWidth="1"
        />

        {/* X labels */}
        {xLabelIdxs.map((i) => (
          <text
            key={i} x={toX(i)} y={height - 4}
            textAnchor="middle" fontSize="9"
            fill="var(--color-text-muted)" fontFamily="var(--font-sans)"
          >
            {shortWeekLabel(allWeekKeys[i])}
          </text>
        ))}

        {/* Per-user lines + final dot + emoji tail */}
        {plotPoints.map(({ series: s, vals }) => {
          const pts: { x: number; y: number }[] = []
          for (let i = 0; i < n; i++) {
            const v = vals[i]
            if (v !== null) pts.push({ x: toX(i), y: toY(v) })
          }
          if (pts.length === 0) return null

          const linePath = catmullRomPath(pts)
          const last = pts[pts.length - 1]

          return (
            <g key={s.user.id}>
              <path
                d={linePath} fill="none"
                stroke={s.color} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              />
              <circle cx={last.x} cy={last.y} r={5} fill={s.color} stroke={s.color} strokeWidth="2" />
              <text
                x={last.x + 9} y={last.y + 5}
                fontSize="15" textAnchor="start"
                style={{ userSelect: 'none' }}
              >
                {s.user.emoji}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Locked placeholder ───────────────────────────────────────────────────────

function LockedChart({ height = 210, message }: { height?: number; message: string }) {
  const iH = height - PAD.top - PAD.bottom
  const iW = VB_W - PAD.left - PAD.right
  const x0 = PAD.left
  const x1 = VB_W - PAD.right
  return (
    <div className="chart-locked">
      <div className="chart-wrap">
        <svg viewBox={`0 0 ${VB_W} ${height}`} width="100%" height={height} aria-hidden="true">
          {[0.3, 0.65].map((t, i) => (
            <line
              key={i} x1={x0} y1={PAD.top + t * iH} x2={x1} y2={PAD.top + t * iH}
              stroke="var(--color-border)" strokeWidth="0.8" strokeDasharray="3 4"
            />
          ))}
          <line x1={x0} y1={PAD.top + iH} x2={x1} y2={PAD.top + iH} stroke="var(--color-border)" strokeWidth="1" />
          <path
            d={`M ${x0},${PAD.top + iH * 0.32} C ${x0 + iW * 0.3},${PAD.top + iH * 0.18} ${x0 + iW * 0.65},${PAD.top + iH * 0.42} ${x1},${PAD.top + iH * 0.28}`}
            fill="none" stroke="var(--color-border)" strokeWidth="2.5" strokeLinecap="round"
          />
          <path
            d={`M ${x0},${PAD.top + iH * 0.68} C ${x0 + iW * 0.3},${PAD.top + iH * 0.55} ${x0 + iW * 0.65},${PAD.top + iH * 0.72} ${x1},${PAD.top + iH * 0.58}`}
            fill="none" stroke="var(--color-border)" strokeWidth="2.5" strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="chart-locked-overlay">
        <span className="chart-locked-msg">{message}</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Battle() {
  const users = useAppStore((s) => s.users)
  const entries = useAppStore((s) => s.entries)

  const series: SeriesData[] = useMemo(
    () =>
      users.map((u, i) => ({
        user: u,
        color: u.favoriteColor ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        averages: computeWeeklyAverages(u.id, entries, 1),
      })),
    [users, entries],
  )

  const activeSeries = series.filter((s) => s.averages.length > 0)

  // The "newest" member = whoever has the latest first entry.
  // Used to label the Race from Here section.
  const newestMember = useMemo((): SeriesData | null => {
    if (activeSeries.length < 2) return null
    return activeSeries.reduce((latest, s) => {
      const k = s.averages[0]?.weekKey ?? ''
      const lk = latest?.averages[0]?.weekKey ?? ''
      return k > lk ? s : latest
    }, activeSeries[0])
  }, [activeSeries])

  // "Race from Here" unlocks when 2+ members have data that overlaps at/after
  // the newest member's first entry. We check this by seeing if at least 2
  // series have data at or after newestMember's first weekKey.
  const raceUnlocked = useMemo(() => {
    if (!newestMember) return false
    const raceStart = newestMember.averages[0]?.weekKey ?? ''
    const participating = activeSeries.filter((s) =>
      s.averages.some((a) => a.weekKey >= raceStart),
    )
    return participating.length >= 2
  }, [activeSeries, newestMember])

  // "Weekly Momentum" unlocks when any member has ≥2 weeks (so delta exists)
  const momentumUnlocked = activeSeries.some((s) => s.averages.some((a) => a.delta !== null))

  return (
    <div className="page" data-testid="battle-section">
      <header className="page-header">
        <div>
          <h1 className="page-title">Battle</h1>
          <span className="page-subtitle">Head-to-head comparison</span>
        </div>
      </header>

      {/* Legend */}
      <div className="battle-legend">
        {series.map((s) => (
          <div key={s.user.id} className="battle-legend-item">
            <span className="battle-legend-dot" style={{ background: s.color }} />
            <span>{s.user.emoji} {s.user.name}</span>
          </div>
        ))}
      </div>

      {/* ── Progress from Start ── */}
      <section className="section">
        <div className="section-title">Progress from Start</div>
        <p className="sync-hint" style={{ marginBottom: 6 }}>
          Each line starts at 0 from that person's own beginning.
        </p>
        {activeSeries.length >= 1 ? (
          <BattleChart series={series} height={210} mode="fromStart" />
        ) : (
          <LockedChart height={210} message="Log weight to see your progress" />
        )}
      </section>

      {/* ── Race from Here ── */}
      <section className="section">
        <div className="section-title">Race from Here</div>
        <p className="sync-hint" style={{ marginBottom: 6 }}>
          {newestMember
            ? `Everyone resets to 0 when ${newestMember.user.emoji} ${newestMember.user.name} started — a level playing field.`
            : 'Everyone resets to 0 at the newest member\'s first entry — a level playing field.'}
        </p>
        {raceUnlocked ? (
          <BattleChart series={series} height={210} mode="fromJoin" />
        ) : (
          <LockedChart height={210} message="2+ members needed to start the race" />
        )}
      </section>

      {/* ── Weekly Momentum ── */}
      <section className="section">
        <div className="section-title">Weekly Momentum</div>
        <p className="sync-hint" style={{ marginBottom: 6 }}>
          Week-over-week change. Competing on recent pace, not total history.
        </p>
        {momentumUnlocked ? (
          <BattleChart series={series} height={190} mode="weeklyDelta" />
        ) : (
          <LockedChart height={190} message="Log 2+ weeks to see your momentum" />
        )}
      </section>

      {/* ── Weekly Averages ── */}
      <section className="section">
        <div className="section-title">Weekly Averages</div>
        <p className="sync-hint" style={{ marginBottom: 6 }}>
          Raw weekly averages — useful when members track in the same unit.
        </p>
        {activeSeries.length >= 2 ? (
          <BattleChart series={series} height={210} mode="absolute" />
        ) : (
          <LockedChart height={210} message="2+ members needed to compare" />
        )}
      </section>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function catmullRomPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let path = `M ${points[0].x} ${points[0].y}`
  const alpha = 0.4
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const cp1x = p1.x + ((p2.x - p0.x) * alpha) / 2
    const cp1y = p1.y + ((p2.y - p0.y) * alpha) / 2
    const cp2x = p2.x - ((p3.x - p1.x) * alpha) / 2
    const cp2y = p2.y - ((p3.y - p1.y) * alpha) / 2
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return path
}

function selectLabelIndices(total: number, max: number): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i)
  const step = (total - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => Math.round(i * step))
}

function shortWeekLabel(weekKey: string): string {
  const [, m, d] = weekKey.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
