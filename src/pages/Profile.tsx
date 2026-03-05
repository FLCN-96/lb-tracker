import { useState, useMemo, useRef, useEffect } from 'react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import { storage } from '@/services/storage'
import { fetchUsers, fetchEntries, pushUsers, pushEntries } from '@/services/github'
import {
  computeWeeklyAverages, computeTrend, computeOLS, computeDescriptives,
  mannKendall, runsTest, computeResiduals, computeACF, normalQuantile,
} from '@/utils/weightCalc'
import type { OLSResult, DescriptiveStats, MannKendallResult, RunsTestResult } from '@/utils/weightCalc'
import type { Gender } from '@/types'

// ─── BMI helpers ──────────────────────────────────────────────────────────────

function calcBMI(weightLbs: number, heightIn: number): number {
  return (weightLbs / (heightIn * heightIn)) * 703
}

function bmiCategory(bmi: number): { label: string; cls: string } {
  if (bmi < 18.5) return { label: 'Underweight', cls: 'bmi-tag--under' }
  if (bmi < 25)   return { label: 'Normal',      cls: 'bmi-tag--normal' }
  if (bmi < 30)   return { label: 'Overweight',  cls: 'bmi-tag--over' }
  return                  { label: 'Obese',       cls: 'bmi-tag--obese' }
}

function weightAtBMI(targetBMI: number, heightIn: number): number {
  return (targetBMI * heightIn * heightIn) / 703
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v)
}

function randomHex(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
}

// ─── Floppy-disk save icon (inline SVG) ───────────────────────────────────────
function FloppyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/>
      <polyline points="7,3 7,8 15,8"/>
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile() {
  const user = useAppStore(selectActiveUser)
  const entries = useAppStore((s) => s.entries)
  const updateUser = useAppStore((s) => s.updateUser)
  const ghConfig = storage.loadGitHubConfig()
  const colorInputRef = useRef<HTMLInputElement>(null)

  // ── Identity form state ────────────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '')
  const [favoriteColor, setFavoriteColor] = useState(user?.favoriteColor ?? '')

  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncFlash, setSyncFlash] = useState<'ok' | 'err' | null>(null)
  const [syncVersion, setSyncVersion] = useState(0)

  // Keep form in sync when the store is updated externally, or when a sync
  // completes (syncVersion bump discards unsaved form edits even if values
  // in the store didn't change).
  useEffect(() => {
    if (!user) return
    setName(user.name)
    setFavoriteColor(user.favoriteColor ?? '')
  }, [user?.name, user?.favoriteColor, syncVersion])

  if (!user) {
    return (
      <div className="page page--centered">
        <p className="empty-state">No profile selected.</p>
      </div>
    )
  }

  // Most recent weight for this user
  const recentWeight = useMemo(() => {
    const sorted = entries
      .filter((e) => e.userId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0]?.weight ?? null
  }, [entries, user.id])

  // ── Dirty check ───────────────────────────────────────────────────────────
  const isDirty =
    name !== user.name ||
    favoriteColor !== (user.favoriteColor ?? '')

  // ── Computed BMI ──────────────────────────────────────────────────────────
  const heightIn = user.heightIn ?? null
  const bmi = heightIn && recentWeight ? calcBMI(recentWeight, heightIn) : null
  const thresholds = heightIn
    ? {
        under:     weightAtBMI(18.5, heightIn),
        normalTop: weightAtBMI(25,   heightIn),
        overTop:   weightAtBMI(30,   heightIn),
      }
    : null

  // ── Trend analysis ────────────────────────────────────────────────────────
  const weeklyAverages = useMemo(
    () => computeWeeklyAverages(user.id, entries, user.weekStartDay ?? 1),
    [user.id, entries, user.weekStartDay],
  )
  const trend = useMemo(() => computeTrend(weeklyAverages), [weeklyAverages])

  const ols       = useMemo(() => computeOLS(weeklyAverages),          [weeklyAverages])
  const desc      = useMemo(() => computeDescriptives(weeklyAverages),  [weeklyAverages])
  const mk        = useMemo(() => mannKendall(weeklyAverages),          [weeklyAverages])
  const rt        = useMemo(() => runsTest(weeklyAverages),             [weeklyAverages])
  const residuals = useMemo(() => ols ? computeResiduals(weeklyAverages, ols) : [], [weeklyAverages, ols])
  const acf       = useMemo(() => computeACF(weeklyAverages, 10),       [weeklyAverages])

  const trendGoalDate = useMemo(() => {
    if (!trend || !user.goalWeight || !recentWeight) return null
    if (trend.ratePerWeek >= 0) return null  // not losing weight
    const weeksRemaining = (recentWeight - user.goalWeight) / (-trend.ratePerWeek)
    if (weeksRemaining <= 0 || weeksRemaining > 520) return null  // sanity check
    const d = new Date()
    d.setDate(d.getDate() + Math.round(weeksRemaining * 7))
    return { date: d, weeks: Math.round(weeksRemaining) }
  }, [trend, user.goalWeight, recentWeight])

  // ── Save handler ──────────────────────────────────────────────────────────
  function handleSave() {
    updateUser(user!.id, {
      name: name.trim() || user!.name,
      favoriteColor: isValidHex(favoriteColor) ? favoriteColor : null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  // ── Sync handler ──────────────────────────────────────────────────────────
  async function handleSync() {
    if (!ghConfig?.token) return
    setSyncing(true)
    setSyncFlash(null)
    try {
      const cfg = { token: ghConfig.token, repo: ghConfig.repo }
      const { users: remoteUsers, sha: usersSha } = await fetchUsers(cfg)
      const { users: localUsers, entries: localEntries } = useAppStore.getState()
      const allIds = new Set([...localUsers.map((u) => u.id), ...remoteUsers.map((u) => u.id)])
      const remoteEntries: import('@/types').WeightEntry[] = []
      const entryShas: Record<string, string | null> = {}
      for (const uid of allIds) {
        const { entries: ue, sha } = await fetchEntries(cfg, uid)
        remoteEntries.push(...ue)
        entryShas[uid] = sha
      }
      await pushUsers(cfg, localUsers, usersSha)
      for (const u of localUsers) {
        const ue = localEntries.filter((e) => e.userId === u.id)
        await pushEntries(cfg, u.id, ue, entryShas[u.id] ?? null, u.name)
      }
      storage.saveGitHubConfig({ ...ghConfig, lastSynced: new Date().toISOString() })
      setSyncFlash('ok')
      setSyncVersion((v) => v + 1)  // discard any unsaved form edits
      setTimeout(() => setSyncFlash(null), 2000)
    } catch {
      setSyncFlash('err')
      setTimeout(() => setSyncFlash(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const displayColor = isValidHex(favoriteColor) ? favoriteColor : undefined

  return (
    <div className="page">
      {/* ── Header with action buttons ── */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <span className="page-subtitle">{user.emoji} {user.name}</span>
        </div>
        <div className="header-actions">
          <button
            className={`btn-icon${isDirty ? ' btn-icon--pulse' : ''}${saved ? ' btn-icon--saved' : ''}`}
            onClick={handleSave}
            disabled={!isDirty && !saved}
            aria-label="Save profile"
            title="Save changes"
          >
            {saved ? '✓' : <FloppyIcon />}
          </button>
          {ghConfig?.token && (
            <button
              className={`btn-sync${syncing ? ' btn-sync--spin' : ''}${
                syncFlash === 'ok' ? ' btn-sync--ok' : syncFlash === 'err' ? ' btn-sync--err' : ''
              }`}
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sync to GitHub"
            >
              ↻
            </button>
          )}
        </div>
      </header>

      {/* ── Identity ── */}
      <section className="section">
        <div className="section-title">Identity</div>
        <div className="form">
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">Display name</label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              maxLength={40}
            />
          </div>

          {/* Favorite color */}
          <div className="form-group">
            <label className="form-label">Favorite color</label>
            <div className="color-row">
              <input
                type="text"
                value={favoriteColor}
                onChange={(e) => setFavoriteColor(e.target.value)}
                className="form-input"
                placeholder="#3a7d44"
                maxLength={7}
                style={displayColor ? { color: displayColor, fontWeight: 700 } : undefined}
              />
              {/* Hidden native color picker */}
              <input
                ref={colorInputRef}
                type="color"
                value={isValidHex(favoriteColor) ? favoriteColor : '#3a7d44'}
                onChange={(e) => setFavoriteColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
                aria-hidden="true"
              />
              <button
                type="button"
                className="color-swatch-btn"
                style={displayColor ? { background: displayColor } : undefined}
                onClick={() => colorInputRef.current?.click()}
                aria-label="Pick color"
                title="Open color picker"
              >
                {!displayColor && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="13.5" cy="6.5" r="2.5"/>
                    <path d="M17 16a5 5 0 1 1-10 0c0-2.5 2-5 5-7.5C15 11 17 13.5 17 16z"/>
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="color-random-btn"
                onClick={() => setFavoriteColor(randomHex())}
                aria-label="Random color"
                title="Random color"
              >
                🎲
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trend Analysis ── */}
      {weeklyAverages.length >= 2 && (
        <section className="section">
          <div className="section-title">Trend</div>
          <div className="trend-card">
            {trend && (
              <div className="trend-rate">
                <span className={`trend-rate__value ${trend.ratePerWeek < 0 ? 'delta--down' : trend.ratePerWeek > 0 ? 'delta--up' : ''}`}>
                  {trend.ratePerWeek > 0 ? '+' : ''}{trend.ratePerWeek.toFixed(1)}
                </span>
                <span className="trend-rate__label">lbs / week (avg over last {Math.min(weeklyAverages.length, 8)} wks)</span>
              </div>
            )}

            {trendGoalDate ? (
              <div className="trend-goal">
                <span className="trend-goal__label">Goal by</span>
                <span className="trend-goal__date">
                  {trendGoalDate.date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </span>
                <span className="trend-goal__weeks">~{trendGoalDate.weeks} week{trendGoalDate.weeks !== 1 ? 's' : ''}</span>
              </div>
            ) : user.goalWeight && recentWeight !== null ? (
              <p className="trend-note">
                {recentWeight <= user.goalWeight
                  ? 'Goal reached! 🎉'
                  : 'Set a consistent pace to see a goal estimate.'}
              </p>
            ) : (
              <p className="trend-note">Set a goal weight in Settings to see an estimate.</p>
            )}
          </div>
        </section>
      )}

      {/* ── BMI analysis ── */}
      {bmi !== null && thresholds !== null && recentWeight !== null && (
        <section className="section">
          <div className="section-title">BMI Analysis</div>
          <div className="bmi-card">
            <div className="bmi-score-row">
              <span className="bmi-score">{bmi.toFixed(1)}</span>
              <span className={`bmi-tag ${bmiCategory(bmi).cls}`}>{bmiCategory(bmi).label}</span>
            </div>
            <div className="bmi-thresholds">
              {[
                { label: 'Underweight (<18.5)', at: thresholds.under, rangeEnd: null },
                { label: 'Normal (18.5–24.9)', at: thresholds.under, rangeEnd: thresholds.normalTop },
                { label: 'Overweight (25–29.9)', at: thresholds.normalTop, rangeEnd: thresholds.overTop },
                { label: 'Obese (≥30)', at: thresholds.overTop, rangeEnd: null },
              ].map(({ label, at, rangeEnd }, i) => {
                const inRange = i === 0
                  ? bmi < 18.5
                  : i === 1
                  ? bmi >= 18.5 && bmi < 25
                  : i === 2
                  ? bmi >= 25 && bmi < 30
                  : bmi >= 30
                const diff = recentWeight - at
                const deltaLabel = inRange
                  ? 'You are here ✓'
                  : diff > 0
                  ? `−${diff.toFixed(1)} lbs to reach`
                  : `+${Math.abs(diff).toFixed(1)} lbs above`
                return (
                  <div key={i} className={`bmi-row${inRange ? ' bmi-row--active' : ''}`}>
                    <span className="bmi-row__label">{label}</span>
                    <span className="bmi-row__value">
                      {rangeEnd
                        ? `${at.toFixed(1)}–${rangeEnd.toFixed(1)} lbs`
                        : i === 0 ? `< ${at.toFixed(1)} lbs` : `> ${at.toFixed(1)} lbs`}
                    </span>
                    <span className={`bmi-row__delta ${inRange ? 'delta--down' : ''}`}>
                      {deltaLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {(!heightIn || recentWeight === null) && (
        <p className="empty-state" style={{ padding: '4px var(--space-md) 16px', fontSize: 13 }}>
          {!heightIn
            ? 'Enter height in Settings to see BMI analysis.'
            : 'Log a weight entry to see BMI analysis.'}
        </p>
      )}

      {/* ── Stats Lab ── */}
      {(ols || desc) && (
        <section className="section">
          <div className="section-title">Stats Lab</div>
          <StatsLab ols={ols} desc={desc} mk={mk} rt={rt} residuals={residuals} acf={acf} unit={user.unit} />
        </section>
      )}
    </div>
  )
}

// ─── Stats Lab helpers ────────────────────────────────────────────────────────

function sigCode(p: number): string {
  if (p < 0.001) return '***'
  if (p < 0.01)  return '**'
  if (p < 0.05)  return '*'
  return 'ns'
}

function fmtP(p: number): string {
  return p < 0.0001 ? '< 0.0001' : p.toFixed(4)
}

function fmtSigned(v: number, decimals = 2): string {
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(decimals)}`
}

function SlRow({ k, v, sig }: { k: string; v: React.ReactNode; sig?: string }) {
  const ns = sig === 'ns'
  return (
    <div className="sl-row">
      <span className="sl-key">{k}</span>
      <span className="sl-rhs">
        <span className="sl-val">{v}</span>
        {sig && <span className={`sl-sig${ns ? ' sl-sig--ns' : ''}`}>{sig}</span>}
      </span>
    </div>
  )
}

function SlDivider({ label }: { label?: string }) {
  return <div className="sl-divider">{label && <span className="sl-divider__label">{label}</span>}</div>
}

function SlTestLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="sl-test-label" style={style}>{children}</div>
}

// ─── SVG diagnostic plots ─────────────────────────────────────────────────────

const PL = { l: 28, r: 10, t: 10, b: 18 }   // plot padding (px in viewBox units)
const PW = 280                                 // plot viewBox width

/** Residuals vs time — lollipop chart with zero baseline. */
function ResidualPlot({ residuals }: { residuals: number[] }) {
  const n = residuals.length
  if (n < 3) return null
  const h = 90
  const iW = PW - PL.l - PL.r
  const iH = h  - PL.t - PL.b
  const maxA = Math.max(...residuals.map(Math.abs)) * 1.25 || 1
  const toX = (i: number) => PL.l + (n > 1 ? (i / (n - 1)) * iW : iW / 2)
  const toY = (r: number) => PL.t + iH / 2 - (r / maxA) * (iH / 2)
  const y0  = toY(0)
  return (
    <svg viewBox={`0 0 ${PW} ${h}`} width="100%" height={h} className="sl-plot">
      {/* ±1σ band */}
      {(() => { const rse = Math.sqrt(residuals.reduce((s, r) => s + r*r, 0) / Math.max(n - 2, 1))
        const yUp = toY(rse), yDn = toY(-rse)
        return <rect x={PL.l} y={yUp} width={iW} height={yDn - yUp} fill="var(--color-primary)" opacity="0.07" />
      })()}
      {/* zero line */}
      <line x1={PL.l} y1={y0} x2={PW - PL.r} y2={y0} stroke="var(--color-text-muted)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
      {/* stems + dots */}
      {residuals.map((r, i) => (
        <g key={i}>
          <line x1={toX(i)} y1={y0} x2={toX(i)} y2={toY(r)} stroke="var(--color-primary)" strokeWidth="1.2" opacity="0.45" />
          <circle cx={toX(i)} cy={toY(r)} r="3" fill="var(--color-primary)" opacity="0.85" />
        </g>
      ))}
      {/* y-axis ticks */}
      {[maxA, 0, -maxA].map((v, i) => (
        <text key={i} x={PL.l - 3} y={toY(v)} textAnchor="end" dominantBaseline="middle"
          fontSize="7" fill="var(--color-text-muted)">{v === 0 ? '0' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`}</text>
      ))}
      {/* x-axis labels */}
      <text x={PL.l}       y={h - 2} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">wk 1</text>
      <text x={PW - PL.r}  y={h - 2} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">wk {n}</text>
    </svg>
  )
}

/** Normal Q-Q plot for residuals. Reference line through Q1–Q3. */
function QQPlot({ residuals }: { residuals: number[] }) {
  const n = residuals.length
  if (n < 5) return null
  const h = 110
  const iW = PW - PL.l - PL.r
  const iH = h  - PL.t - PL.b

  const sorted  = [...residuals].sort((a, b) => a - b)
  const theor   = sorted.map((_, i) => normalQuantile((i + 1 - 0.375) / (n + 0.25)))
  const xMin = theor[0], xMax = theor[n - 1]
  const yMin = sorted[0] * 1.15, yMax = sorted[n - 1] * 1.15 || 1

  const toX = (q: number) => PL.l + ((q - xMin) / (xMax - xMin || 1)) * iW
  const toY = (v: number) => PL.t + iH - ((v - yMin) / ((yMax - yMin) || 1)) * iH

  // Reference line through quartiles (robust)
  const q1i = Math.max(0, Math.floor(n * 0.25))
  const q3i = Math.min(n - 1, Math.floor(n * 0.75))
  const [tx1, ty1, tx2, ty2] = [theor[q1i], sorted[q1i], theor[q3i], sorted[q3i]]
  const slope = (tx2 - tx1) !== 0 ? (ty2 - ty1) / (tx2 - tx1) : 1
  const refY = (x: number) => ty1 + slope * (x - tx1)

  return (
    <svg viewBox={`0 0 ${PW} ${h}`} width="100%" height={h} className="sl-plot">
      {/* Reference line */}
      <line
        x1={toX(xMin)} y1={toY(refY(xMin))}
        x2={toX(xMax)} y2={toY(refY(xMax))}
        stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="4 3" opacity="0.6"
      />
      {/* Points */}
      {sorted.map((r, i) => (
        <circle key={i} cx={toX(theor[i])} cy={toY(r)} r="2.8" fill="var(--color-primary)" opacity="0.8" />
      ))}
      {/* Axis labels */}
      <text x={PW / 2}  y={h - 1}    textAnchor="middle"  fontSize="7" fill="var(--color-text-muted)">Theoretical quantiles</text>
      <text x={8}       y={h / 2}     textAnchor="middle"  fontSize="7" fill="var(--color-text-muted)"
        transform={`rotate(-90 8 ${h / 2})`}>Sample</text>
      {/* Corner quantile labels */}
      <text x={toX(xMin)} y={h - 1} textAnchor="middle" fontSize="6" fill="var(--color-text-muted)">{xMin.toFixed(1)}</text>
      <text x={toX(xMax)} y={h - 1} textAnchor="middle" fontSize="6" fill="var(--color-text-muted)">{xMax.toFixed(1)}</text>
    </svg>
  )
}

/** ACF correlogram for lags 1…k. Bars outside ±1.96/√n highlighted. */
function ACFPlot({ acf, n }: { acf: number[]; n: number }) {
  const k = acf.length
  if (k < 1) return null
  const h = 90
  const iW = PW - PL.l - PL.r
  const iH = h  - PL.t - PL.b
  const ci  = 1.96 / Math.sqrt(n)

  // Always show full [−1, 1] range so scale is intuitive
  const toY = (v: number) => PL.t + iH * (1 - (v + 1) / 2)
  const y0  = toY(0)
  const yCI_u = toY(ci), yCI_l = toY(-ci)
  const bw  = Math.min(14, (iW / k) * 0.6)
  const barX = (lag: number) => PL.l + ((lag - 0.5) / k) * iW

  return (
    <svg viewBox={`0 0 ${PW} ${h}`} width="100%" height={h} className="sl-plot">
      {/* CI bands */}
      <rect x={PL.l} y={yCI_u} width={iW} height={yCI_l - yCI_u} fill="var(--color-primary)" opacity="0.06" />
      <line x1={PL.l} y1={yCI_u} x2={PW - PL.r} y2={yCI_u} stroke="var(--color-text-muted)" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.55" />
      <line x1={PL.l} y1={yCI_l} x2={PW - PL.r} y2={yCI_l} stroke="var(--color-text-muted)" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.55" />
      {/* Zero line */}
      <line x1={PL.l} y1={y0} x2={PW - PL.r} y2={y0} stroke="var(--color-border)" strokeWidth="0.9" />
      {/* Bars */}
      {acf.map((r, i) => {
        const sig = Math.abs(r) > ci
        const x   = barX(i + 1)
        return (
          <g key={i}>
            <rect
              x={x - bw / 2} y={r >= 0 ? toY(r) : y0}
              width={bw} height={Math.abs(toY(r) - y0)}
              fill="var(--color-primary)" opacity={sig ? 0.85 : 0.3}
            />
            <text x={x} y={h - 2} textAnchor="middle" fontSize="7" fill="var(--color-text-muted)">{i + 1}</text>
          </g>
        )
      })}
      {/* Y axis ticks */}
      {[1, 0, -1].map((v) => (
        <text key={v} x={PL.l - 3} y={toY(v)} textAnchor="end" dominantBaseline="middle"
          fontSize="7" fill="var(--color-text-muted)">{v}</text>
      ))}
      {/* CI label */}
      <text x={PW - PL.r} y={yCI_u - 2} textAnchor="end" fontSize="6" fill="var(--color-text-muted)" opacity="0.7">±{ci.toFixed(2)}</text>
    </svg>
  )
}

// ─── StatsLab component ───────────────────────────────────────────────────────

function StatsLab({
  ols, desc, mk, rt, residuals, acf, unit,
}: {
  ols: OLSResult | null
  desc: DescriptiveStats | null
  mk: MannKendallResult | null
  rt: RunsTestResult | null
  residuals: number[]
  acf: number[]
  unit: import('@/types').WeightUnit
}) {
  const u = unit
  const n = desc?.n ?? 0
  const showPlots = residuals.length >= 3 || acf.length >= 1

  return (
    <div className="stats-lab">

      {/* ── OLS ── */}
      {ols && (
        <>
          <SlDivider label={`OLS: weight ~ week  (n = ${ols.n})`} />
          <SlRow k="slope"   v={`${fmtSigned(ols.slope)} ${u}/wk`}                              sig={sigCode(ols.pValue)} />
          <SlRow k="95% CI"  v={`[${fmtSigned(ols.ci95[0])}, ${fmtSigned(ols.ci95[1])}] ${u}`} />
          <SlRow k="p-value" v={fmtP(ols.pValue)} />
          <SlRow k="t-stat"  v={`${fmtSigned(ols.tStat)}  (df\u202f=\u202f${ols.n - 2})`} />
          <SlRow k="R²"      v={ols.r2.toFixed(3)} />
          <SlRow k="adj. R²" v={ols.adjR2.toFixed(3)} />
          <SlRow k="RSE"     v={`${ols.rse.toFixed(2)} ${u}`} />
          <div className="sl-footnote">Sig. codes:&nbsp; *** p&lt;0.001 &nbsp; ** p&lt;0.01 &nbsp; * p&lt;0.05 &nbsp; ns p≥0.05</div>
        </>
      )}

      {/* ── Non-Parametric Tests ── */}
      {(mk || rt) && (
        <>
          <SlDivider label="Non-Parametric Tests" />
          {mk && (
            <>
              <SlTestLabel>Mann-Kendall (H₀: no monotonic trend)</SlTestLabel>
              <SlRow k="S"      v={mk.S} />
              <SlRow k="τ"      v={mk.tau.toFixed(3)} />
              <SlRow k="z"      v={fmtSigned(mk.z)} />
              <SlRow k="p"      v={fmtP(mk.pValue)} sig={sigCode(mk.pValue)} />
            </>
          )}
          {rt && (
            <>
              <SlTestLabel style={{ marginTop: 8 }}>Runs test (H₀: sequence is random)</SlTestLabel>
              <SlRow k="runs"   v={`${rt.runs}  (n₊=${rt.n1}, n₋=${rt.n2})`} />
              <SlRow k="z"      v={fmtSigned(rt.z)} />
              <SlRow k="p"      v={fmtP(rt.pValue)} sig={sigCode(rt.pValue)} />
            </>
          )}
        </>
      )}

      {/* ── Descriptives ── */}
      {desc && (
        <>
          <SlDivider label="Descriptives" />
          <SlRow k="mean"     v={`${desc.mean.toFixed(2)} ${u}`} />
          <SlRow k="σ  (SD)"  v={`${desc.sd.toFixed(2)} ${u}`} />
          <SlRow k="CV"       v={`${desc.cv.toFixed(1)}%`} />
          <SlRow k="range"    v={`${desc.range.toFixed(2)} ${u}  (${desc.min}–${desc.max})`} />
          {desc.skewness !== null && <SlRow k="skewness" v={fmtSigned(desc.skewness)} />}
        </>
      )}

      {/* ── Diagnostic Plots ── */}
      {showPlots && (
        <>
          <SlDivider label="Diagnostic Plots" />
          {residuals.length >= 3 && (
            <div className="sl-plot-wrap">
              <div className="sl-plot-label">Residuals vs Time</div>
              <ResidualPlot residuals={residuals} />
            </div>
          )}
          {residuals.length >= 5 && (
            <div className="sl-plot-wrap">
              <div className="sl-plot-label">Normal Q-Q (residuals)</div>
              <QQPlot residuals={residuals} />
            </div>
          )}
          {acf.length >= 1 && (
            <div className="sl-plot-wrap">
              <div className="sl-plot-label">ACF — weekly averages (lag, wks)</div>
              <ACFPlot acf={acf} n={n} />
            </div>
          )}
        </>
      )}

    </div>
  )
}
