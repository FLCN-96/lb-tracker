import { useActiveUserData } from '@/hooks/useWeightData'
import { useAppStore } from '@/store/useAppStore'
import { formatWeight, formatDelta } from '@/utils/weightCalc'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const data = useActiveUserData()
  const hasUsers = useAppStore((s) => s.users.length > 0)

  if (!hasUsers) {
    return (
      <div className="page page--centered">
        <h1 className="page-title">LB Tracker</h1>
        <p className="page-subtitle">Track your weekly average weight loss with friends.</p>
        <Link to="/profile" className="btn btn--primary">
          Get Started
        </Link>
      </div>
    )
  }

  if (!data) return null

  const { user, currentWeek, previousWeek, totalLost, streak, weeklyAverages } = data

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span className="page-subtitle">{user.name}</span>
      </header>

      {/* ── Stat cards ── */}
      <section className="stat-grid" aria-label="Weekly stats">
        <div className="stat-card">
          <span className="stat-label">This Week Avg</span>
          <span className="stat-value">
            {currentWeek ? formatWeight(currentWeek.average, user.unit) : '—'}
          </span>
          <span className="stat-sub">
            {currentWeek ? `${currentWeek.entryCount} entr${currentWeek.entryCount === 1 ? 'y' : 'ies'}` : 'No entries yet'}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Week Change</span>
          <span
            className={`stat-value ${
              currentWeek?.delta == null
                ? ''
                : currentWeek.delta < 0
                ? 'stat-value--down'
                : currentWeek.delta > 0
                ? 'stat-value--up'
                : ''
            }`}
          >
            {formatDelta(currentWeek?.delta ?? null, user.unit)}
          </span>
          <span className="stat-sub">vs last week</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Total Lost</span>
          <span className="stat-value stat-value--down">
            {totalLost !== null ? formatDelta(-totalLost, user.unit) : '—'}
          </span>
          <span className="stat-sub">since first entry</span>
        </div>

        <div className="stat-card">
          <span className="stat-label">Streak</span>
          <span className="stat-value">{streak}</span>
          <span className="stat-sub">week{streak !== 1 ? 's' : ''}</span>
        </div>
      </section>

      {/* ── Recent weeks list ── */}
      <section className="section">
        <h2 className="section-title">Weekly History</h2>
        {weeklyAverages.length === 0 ? (
          <p className="empty-state">
            No entries yet.{' '}
            <Link to="/log" className="link">
              Log your first weight
            </Link>
            .
          </p>
        ) : (
          <ul className="week-list">
            {[...weeklyAverages].reverse().map((w) => (
              <li key={w.weekKey} className="week-row">
                <span className="week-range">
                  {formatDateRange(w.weekStart, w.weekEnd)}
                </span>
                <span className="week-avg">{formatWeight(w.average, user.unit)}</span>
                <span
                  className={`week-delta ${
                    w.delta === null ? '' : w.delta < 0 ? 'delta--down' : w.delta > 0 ? 'delta--up' : ''
                  }`}
                >
                  {formatDelta(w.delta, user.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Goal progress ── */}
      {user.goalWeight !== null && currentWeek && (
        <section className="section">
          <h2 className="section-title">Goal Progress</h2>
          <GoalBar
            current={currentWeek.average}
            start={user.startingWeight ?? currentWeek.average}
            goal={user.goalWeight}
            unit={user.unit}
          />
        </section>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GoalBar({
  current,
  start,
  goal,
  unit,
}: {
  current: number
  start: number
  goal: number
  unit: import('@/types').WeightUnit
}) {
  const total = Math.abs(start - goal)
  const done = Math.abs(start - current)
  const pct = total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100))

  return (
    <div className="goal-bar-wrap">
      <div className="goal-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="goal-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="goal-bar__labels">
        <span>{formatWeight(start, unit)}</span>
        <span className="goal-bar__pct">{pct}%</span>
        <span>{formatWeight(goal, unit)}</span>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const [, m, day] = d.split('-')
    return `${parseInt(m)}/${parseInt(day)}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}
