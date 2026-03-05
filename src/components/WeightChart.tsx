import type { WeeklyAverage, WeightEntry, WeightUnit } from '@/types'

interface Props {
  data: WeeklyAverage[]
  unit: WeightUnit
  height?: number
  dailyEntries?: WeightEntry[]
}

const PAD = { top: 18, right: 12, bottom: 28, left: 44 }
const VB_W = 360

export default function WeightChart({ data, unit, height = 180, dailyEntries = [] }: Props) {
  if (data.length < 1) {
    return (
      <div className="chart-wrap">
        <div className="chart-empty">Log entries to see your trend</div>
      </div>
    )
  }

  // If only 1 point, duplicate it so we still render a flat line
  const pts = data.length === 1 ? [data[0], data[0]] : data
  const weights = pts.map((d) => d.average)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const rawRange = maxW - minW
  const range = rawRange < 2 ? 4 : rawRange

  const paddedMin = minW - range * 0.15
  const paddedMax = maxW + range * 0.15

  const innerW = VB_W - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom

  const toX = (i: number) =>
    PAD.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW)
  const toY = (w: number) =>
    PAD.top + (1 - (w - paddedMin) / (paddedMax - paddedMin)) * innerH

  const svgPts = pts.map((d, i) => ({ x: toX(i), y: toY(d.average), d }))

  const linePath = catmullRomPath(svgPts)
  const bottomY = PAD.top + innerH
  const areaPath = `${linePath} L ${svgPts[svgPts.length - 1].x},${bottomY} L ${svgPts[0].x},${bottomY} Z`

  // Y-axis: 3 labels
  const yTicks = [paddedMax, (paddedMax + paddedMin) / 2, paddedMin]

  // X-axis: up to 5 labels
  const xLabelIdxs = selectLabelIndices(pts.length, 5)

  // Daily dots: map date → X using the full date range of the chart
  const startMs = new Date(pts[0].weekStart + 'T12:00:00Z').getTime()
  const endMs = new Date(pts[pts.length - 1].weekEnd + 'T12:00:00Z').getTime()
  const msRange = endMs - startMs

  function dateToX(dateStr: string): number {
    if (msRange === 0) return PAD.left + innerW / 2
    const t = new Date(dateStr + 'T12:00:00Z').getTime()
    return PAD.left + ((t - startMs) / msRange) * innerW
  }

  const dailyDots = dailyEntries
    .filter((e) => {
      const t = new Date(e.date + 'T12:00:00Z').getTime()
      return t >= startMs && t <= endMs
    })
    .map((e) => ({
      x: dateToX(e.date),
      y: Math.max(PAD.top, Math.min(PAD.top + innerH, toY(e.weight))),
    }))

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${VB_W} ${height}`}
        width="100%"
        height={height}
        aria-label="Weekly weight trend chart"
        role="img"
      >
        <defs>
          <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((tick, i) => {
          const y = toY(tick)
          return (
            <g key={i}>
              <line
                x1={PAD.left} y1={y} x2={VB_W - PAD.right} y2={y}
                stroke="var(--color-border)" strokeWidth="0.8" strokeDasharray="3 4"
              />
              <text
                x={PAD.left - 5} y={y}
                textAnchor="end" dominantBaseline="middle"
                fontSize="9" fill="var(--color-text-muted)" fontFamily="var(--font-sans)"
              >
                {tick.toFixed(0)}
              </text>
            </g>
          )
        })}

        {/* X axis baseline */}
        <line
          x1={PAD.left} y1={bottomY} x2={VB_W - PAD.right} y2={bottomY}
          stroke="var(--color-border)" strokeWidth="1"
        />

        {/* X labels */}
        {xLabelIdxs.map((i) => (
          <text
            key={i} x={svgPts[i].x} y={height - 4}
            textAnchor="middle" fontSize="9"
            fill="var(--color-text-muted)" fontFamily="var(--font-sans)"
          >
            {shortWeekLabel(pts[i].weekStart)}
          </text>
        ))}

        {/* ── Daily raw entry dots — rendered first so weekly line sits on top ── */}
        {dailyDots.map((dot, i) => (
          <circle
            key={i} cx={dot.x} cy={dot.y} r={2.2}
            fill="var(--color-text-muted)" opacity="0.28"
          />
        ))}

        {/* Area fill */}
        {pts.length > 1 && <path d={areaPath} fill="url(#chart-area-grad)" />}

        {/* Weekly average line */}
        <path
          d={linePath} fill="none"
          stroke="var(--color-primary)" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        />

        {/* Weekly data point dots */}
        {svgPts.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y}
            r={i === svgPts.length - 1 ? 5 : 3.5}
            fill={i === svgPts.length - 1 ? 'var(--color-primary)' : 'var(--color-surface)'}
            stroke="var(--color-primary)" strokeWidth="2"
          />
        ))}

        {/* Latest value label */}
        {svgPts.length > 0 && (() => {
          const last = svgPts[svgPts.length - 1]
          const labelY = last.y < PAD.top + 18 ? last.y + 16 : last.y - 10
          return (
            <text
              x={last.x} y={labelY}
              textAnchor="middle" fontSize="10" fontWeight="700"
              fill="var(--color-primary)" fontFamily="var(--font-sans)"
            >
              {last.d.average.toFixed(1)} {unit}
            </text>
          )
        })()}
      </svg>
    </div>
  )
}

// ─── Smooth curve helpers ─────────────────────────────────────────────────────

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

function shortWeekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split('-')
  return `${parseInt(m)}/${parseInt(d)}`
}
