import { useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { computeWeeklyAverages } from '@/utils/weightCalc'
import type { User, WeeklyAverage } from '@/types'

const FALLBACK_COLORS = [
  '#4f9cf9', '#f97316', '#a855f7', '#10b981',
  '#ef4444', '#eab308', '#6366f1', '#ec4899',
]

const PAD = { top: 24, right: 48, bottom: 28, left: 44 }
const VB_W = 360

interface SeriesData {
  user: User
  color: string
  averages: WeeklyAverage[]
}

// ─── Multi-series chart ───────────────────────────────────────────────────────

function BattleChart({
  series,
  height = 210,
  normalize = false,
}: {
  series: SeriesData[]
  height?: number
  normalize?: boolean
}) {
  const active = series.filter((s) => s.averages.length > 0)
  if (active.length === 0) return <div className="chart-empty">No data yet</div>

  // Union of all week keys, ascending
  const allWeekKeys = [
    ...new Set(active.flatMap((s) => s.averages.map((a) => a.weekKey))),
  ].sort()
  const n = allWeekKeys.length

  // Per-series baseline-adjusted values (null = no entry that week)
  const seriesVals = active.map((s) => {
    const baseline = normalize
      ? (s.user.startingWeight ?? s.averages[0].average)
      : 0
    const byWeek = new Map(s.averages.map((a) => [a.weekKey, a.average]))
    return allWeekKeys.map<number | null>((k) =>
      byWeek.has(k) ? byWeek.get(k)! - baseline : null,
    )
  })

  const flat = seriesVals.flat().filter((v): v is number => v !== null)
  if (flat.length === 0) return <div className="chart-empty">No data yet</div>

  const minV = Math.min(...flat)
  const maxV = Math.max(...flat)
  const rawRange = maxV - minV
  const range = rawRange < 2 ? 4 : rawRange
  // For normalized chart always include 0 in range
  const paddedMin = normalize ? Math.min(minV - range * 0.12, -1) : minV - range * 0.12
  const paddedMax = normalize ? Math.max(maxV + range * 0.12, 1) : maxV + range * 0.12

  const innerW = VB_W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const toX = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const toY = (v: number) => PAD.top + (1 - (v - paddedMin) / (paddedMax - paddedMin)) * innerH
  const bottomY = PAD.top + innerH

  const yTicks = normalize
    ? [paddedMax, 0, paddedMin]
    : [paddedMax, (paddedMax + paddedMin) / 2, paddedMin]

  const xLabelIdxs = selectLabelIndices(n, 5)
  const zeroY = normalize ? toY(0) : null

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        width="100%"
        height={height}
        overflow="visible"
        role="img"
        aria-label={normalize ? 'Progress from start chart' : 'Weekly averages comparison chart'}
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
                {normalize ? `${tick > 0 ? '+' : ''}${tick.toFixed(0)}` : tick.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* Zero line for normalized chart */}
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

        {/* Per-user lines + dots + emoji tail */}
        {active.map((s, si) => {
          const pts: { x: number; y: number }[] = []
          for (let i = 0; i < n; i++) {
            const v = seriesVals[si][i]
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
              {pts.map((p, pi) => (
                <circle
                  key={pi} cx={p.x} cy={p.y}
                  r={pi === pts.length - 1 ? 5 : 3}
                  fill={pi === pts.length - 1 ? s.color : 'var(--color-surface)'}
                  stroke={s.color} strokeWidth="2"
                />
              ))}
              {/* Emoji at the tail */}
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

  if (users.length < 2) {
    return (
      <div className="page page--centered">
        <p className="empty-state">Battle needs at least 2 profiles.</p>
      </div>
    )
  }

  return (
    <div className="page">
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

      {activeSeries.length < 2 ? (
        <p className="empty-state" style={{ marginTop: 24 }}>
          Log data for at least 2 members to see the charts.
        </p>
      ) : (
        <>
          <section className="section">
            <div className="section-title">Weekly Averages</div>
            <BattleChart series={series} height={210} />
          </section>

          <section className="section">
            <div className="section-title">Progress from Start</div>
            <p className="sync-hint" style={{ marginBottom: 8 }}>
              Normalized to each person's starting weight — negative = weight lost.
            </p>
            <BattleChart series={series} height={210} normalize />
          </section>
        </>
      )}
    </div>
  )
}

// ─── Helpers (mirrored from WeightChart for independence) ─────────────────────

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
