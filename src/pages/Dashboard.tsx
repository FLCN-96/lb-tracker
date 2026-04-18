import { useState } from 'react'
import { useActiveUserData } from '@/hooks/useWeightData'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import { formatWeight, formatDelta, todayStr } from '@/utils/weightCalc'
import WeightChart from '@/components/WeightChart'
import ExpandLog from '@/components/ExpandLog'
import { storage } from '@/services/storage'
import { fetchUsers, fetchEntries, pushUsers, pushEntries } from '@/services/github'

export default function Dashboard() {
  const data = useActiveUserData()
  const user = useAppStore(selectActiveUser)
  const addEntry = useAppStore((s) => s.addEntry)
  const entries = useAppStore((s) => s.entries)

  const mergeData = useAppStore((s) => s.mergeData)
  const [weightInput, setWeightInput] = useState('')
  const [logSaved, setLogSaved] = useState(false)
  const [showExpand, setShowExpand] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncFlash, setSyncFlash] = useState<'ok' | 'err' | null>(null)
  const ghConfig = storage.loadGitHubConfig()

  if (!user) return null  // handled by App login flow

  const today = todayStr()
  const todaysEntries = entries.filter((e) => e.userId === user.id && e.date === today)
  const hasLoggedToday = todaysEntries.length > 0
  const latestTodayWeight = todaysEntries.at(-1)?.weight ?? null

  function handleQuickLog(e: React.FormEvent) {
    e.preventDefault()
    const w = parseFloat(weightInput)
    if (isNaN(w) || w < 20 || w > 1500) return
    addEntry(user!.id, w, today)
    setLogSaved(true)
    setTimeout(() => {
      setWeightInput('')
      setLogSaved(false)
    }, 1400)
  }

  async function handleQuickSync() {
    if (!ghConfig?.token) return
    const cfg = { token: ghConfig.token, repo: ghConfig.repo }
    setSyncing(true)
    setSyncFlash(null)
    try {
      const { users: remoteUsers, sha: usersSha } = await fetchUsers(cfg)
      const tombstones = new Set(storage.loadDeletedUserIds())
      const filteredRemote = remoteUsers.filter((u) => !tombstones.has(u.id))
      const { users: localUsers } = useAppStore.getState()
      const allUserIds = new Set([...localUsers.map((u) => u.id), ...filteredRemote.map((u) => u.id)])
      const remoteEntries: import('@/types').WeightEntry[] = []
      const entryShas: Record<string, string | null> = {}
      for (const uid of allUserIds) {
        const { entries: ue, sha } = await fetchEntries(cfg, uid)
        remoteEntries.push(...ue)
        entryShas[uid] = sha
      }
      mergeData(filteredRemote, remoteEntries.filter((e) => !tombstones.has(e.userId)))
      const merged = useAppStore.getState()
      await pushUsers(cfg, merged.users, usersSha)
      for (const u of merged.users) {
        const ue = merged.entries.filter((e) => e.userId === u.id)
        await pushEntries(cfg, u.id, ue, entryShas[u.id] ?? null, u.name)
      }
      storage.saveDeletedUserIds([])
      storage.saveGitHubConfig({ ...ghConfig, lastSynced: new Date().toISOString() })
      setSyncFlash('ok')
      setTimeout(() => setSyncFlash(null), 2000)
    } catch {
      setSyncFlash('err')
      setTimeout(() => setSyncFlash(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const { weeklyAverages, currentWeek, previousWeek, totalLost, streak } = data ?? {
    weeklyAverages: [],
    currentWeek: null,
    previousWeek: null,
    totalLost: null,
    streak: 0,
  }

  // Days remaining in the current week (0 = today is last day, null = not in current week)
  const daysLeft = (() => {
    if (!currentWeek) return null
    const todayMs  = new Date(today + 'T12:00:00Z').getTime()
    const weekEndMs = new Date(currentWeek.weekEnd + 'T12:00:00Z').getTime()
    if (todayMs > weekEndMs) return null               // current data is from a past week
    return Math.round((weekEndMs - todayMs) / 86400000)
  })()

  const statsDimmed = !hasLoggedToday && weeklyAverages.length === 0

  return (
    <>
      <div className="page" style={{ paddingTop: 'var(--space-md)' }}>

        {/* ── Header ── */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px' }}>
              {user.emoji} {user.name}
            </h1>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {formatDate(today)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasLoggedToday && (
              <div className="today-badge">
                <span>✓</span> Logged
              </div>
            )}
            {ghConfig?.token && (
              <button
                className={`btn-sync${syncing ? ' btn-sync--spin' : ''}${syncFlash === 'ok' ? ' btn-sync--ok' : syncFlash === 'err' ? ' btn-sync--err' : ''}`}
                onClick={handleQuickSync}
                disabled={syncing}
                aria-label="Sync with GitHub"
                data-testid="sync-btn"
              >
                ↻
              </button>
            )}
          </div>
        </header>

        {/* ── Chart ── */}
        <WeightChart
          data={weeklyAverages}
          unit={user.unit}
          height={190}
          dailyEntries={entries.filter((e) => e.userId === user.id)}
        />

        {/* ── Log today ── */}
        <div className="log-section">
          <p className="log-section__label">
            {hasLoggedToday
              ? `Today: ${latestTodayWeight?.toFixed(1)} ${user.unit} — add another reading?`
              : "Log today's weight"}
          </p>

          <form className="log-inline" onSubmit={handleQuickLog} data-testid="quick-log-form">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="1500"
              className="log-inline__input"
              placeholder={hasLoggedToday ? (latestTodayWeight?.toFixed(1) ?? '—') : '0.0'}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              data-testid="quick-log-input"
            />
            <span className="log-inline__unit">{user.unit}</span>

            <button
              type="submit"
              className={`btn log-save-btn ${logSaved ? 'btn--saved' : `btn--primary${weightInput ? ' btn--pulse' : ''}`}`}
              disabled={!weightInput}
              data-testid="quick-log-save"
            >
              {logSaved ? '✓' : 'Save'}
            </button>
          </form>

          <div className="log-section__actions">
            <button
              className="log-expand-btn"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setShowExpand(true)}
              data-testid="expand-log-btn"
            >
              <span>↕</span>
              Adjust recent values
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className={`stats-section ${statsDimmed ? 'stats-section--dim' : ''}`}>
          <div className="section">
            <div className="section-title">This week</div>
            <div className="stat-grid">
              <div className="stat-card" data-testid="stat-weekly-avg">
                <span className="stat-label">Weekly Avg</span>
                <span className="stat-value">
                  {currentWeek ? formatWeight(currentWeek.average, user.unit) : '—'}
                </span>
                <span className="stat-sub">
                  {currentWeek
                    ? `${currentWeek.entryCount} logged${
                        daysLeft !== null
                          ? daysLeft === 0 ? ' · ends today' : ` · ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
                          : ''
                      }`
                    : 'no data'}
                </span>
              </div>

              <div className="stat-card" data-testid="stat-vs-last-week">
                <span className="stat-label">vs Last Week</span>
                <span
                  className={`stat-value ${
                    !currentWeek?.delta ? '' :
                    currentWeek.delta < 0 ? 'stat-value--down' : 'stat-value--up'
                  }`}
                >
                  {currentWeek?.delta != null ? formatDelta(currentWeek.delta, user.unit) : '—'}
                </span>
                <span className="stat-sub">
                  {previousWeek ? formatWeight(previousWeek.average, user.unit) : 'no prior week'}
                </span>
              </div>

              <div className="stat-card" data-testid="stat-total-lost">
                <span className="stat-label">Total Lost</span>
                <span className="stat-value stat-value--down">
                  {totalLost !== null && totalLost > 0
                    ? `−${totalLost.toFixed(1)} ${user.unit}`
                    : totalLost !== null && totalLost < 0
                    ? `+${Math.abs(totalLost).toFixed(1)} ${user.unit}`
                    : '—'}
                </span>
                <span className="stat-sub">all time</span>
              </div>

              <div className="stat-card" data-testid="stat-streak">
                <span className="stat-label">Streak</span>
                <span className="stat-value stat-value--primary">{streak}</span>
                <span className="stat-sub">week{streak !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          {user.goalWeight !== null && currentWeek && (
            <div className="section">
              <div className="section-title">Goal progress</div>
              <GoalBar
                current={currentWeek.average}
                start={user.startingWeight ?? currentWeek.average}
                goal={user.goalWeight}
                unit={user.unit}
              />
            </div>
          )}

          {weeklyAverages.length > 0 && (
            <div className="section">
              <div className="section-title">Weekly history</div>
              <ul className="week-list">
                {[...weeklyAverages].reverse().slice(0, 8).map((w) => (
                  <li key={w.weekKey} className="week-row">
                    <span className="week-range">{fmtRange(w.weekStart, w.weekEnd)}</span>
                    <span className="week-avg">{formatWeight(w.average, user.unit)}</span>
                    <span className={`week-delta ${w.delta === null ? '' : w.delta < 0 ? 'delta--down' : w.delta > 0 ? 'delta--up' : ''}`}>
                      {formatDelta(w.delta, user.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>

      {showExpand && (
        <ExpandLog
          userId={user.id}
          unit={user.unit}
          onClose={() => setShowExpand(false)}
        />
      )}
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GoalBar({ current, start, goal, unit }: {
  current: number; start: number; goal: number; unit: import('@/types').WeightUnit
}) {
  const total = Math.abs(start - goal)
  const done  = Math.abs(start - current)
  const pct   = total === 0 ? 100 : Math.min(100, Math.round((done / total) * 100))
  return (
    <div className="goal-bar-wrap" data-testid="goal-bar">
      <div className="goal-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="goal-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="goal-bar__labels">
        <span>{formatWeight(start, unit)}</span>
        <span className="goal-bar__pct" data-testid="goal-bar-pct">{pct}%</span>
        <span>{formatWeight(goal, unit)}</span>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function fmtRange(start: string, end: string): string {
  const f = (s: string) => { const [, m, d] = s.split('-'); return `${parseInt(m)}/${parseInt(d)}` }
  return `${f(start)}–${f(end)}`
}
