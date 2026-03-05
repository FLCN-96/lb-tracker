import { useState } from 'react'

function FloppyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/>
      <polyline points="7,3 7,8 15,8"/>
    </svg>
  )
}
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import { storage } from '@/services/storage'
import {
  fetchUsers,
  fetchEntries,
  pushUsers,
  pushEntries,
} from '@/services/github'
import type { GitHubConfig } from '@/services/github'
import type { Gender } from '@/types'

type EditTarget = { id: string; date: string; weight: number; note: string | null }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export default function Settings() {
  const user = useAppStore(selectActiveUser)
  const entries = useAppStore((s) => s.entries)
  const updateUser = useAppStore((s) => s.updateUser)
  const updateEntry = useAppStore((s) => s.updateEntry)
  const removeEntry = useAppStore((s) => s.removeEntry)
  const mergeData = useAppStore((s) => s.mergeData)

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSaved, setEditSaved] = useState(false)

  // Body & goal settings
  const [goalW, setGoalW] = useState(user?.goalWeight?.toString() ?? '')
  const [startW, setStartW] = useState(user?.startingWeight?.toString() ?? '')
  const [heightFt, setHeightFt] = useState<string>(
    user?.heightIn ? String(Math.floor(user.heightIn / 12)) : '',
  )
  const [heightInVal, setHeightInVal] = useState<string>(
    user?.heightIn ? String(user.heightIn % 12) : '',
  )
  const [gender, setGender] = useState<Gender | ''>(user?.gender ?? '')
  const [weekStartDay, setWeekStartDay] = useState<number>(user?.weekStartDay ?? 1)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Dirty: compare current inputs to stored user values
  const storedHeightFt = user?.heightIn ? String(Math.floor(user.heightIn / 12)) : ''
  const storedHeightIn = user?.heightIn ? String(user.heightIn % 12) : ''
  const settingsDirty =
    goalW        !== (user?.goalWeight?.toString()     ?? '')    ||
    startW       !== (user?.startingWeight?.toString() ?? '')    ||
    heightFt     !== storedHeightFt                              ||
    heightInVal  !== storedHeightIn                              ||
    gender       !== (user?.gender ?? '')                        ||
    weekStartDay !== (user?.weekStartDay ?? 1)

  // GitHub sync
  const stored = storage.loadGitHubConfig()
  const [ghRepo, setGhRepo] = useState(stored?.repo ?? 'FLCN-96/lb-tracker')
  const [ghToken, setGhToken] = useState(stored?.token ?? '')
  const [showToken, setShowToken] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSynced, setLastSynced] = useState<Date | null>(
    stored?.lastSynced ? new Date(stored.lastSynced) : null,
  )

  if (!user) {
    return (
      <div className="page page--centered">
        <p className="empty-state">No profile. Add one on the login screen.</p>
      </div>
    )
  }

  // All entries for this user, sorted newest first
  const userEntries = entries
    .filter((e) => e.userId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date))

  function openEdit(entry: (typeof userEntries)[0]) {
    setEditTarget({ id: entry.id, date: entry.date, weight: entry.weight, note: entry.note })
    setEditWeight(String(entry.weight))
    setEditNote(entry.note ?? '')
    setEditSaved(false)
  }

  function handleSaveEntry() {
    if (!editTarget) return
    const w = parseFloat(editWeight)
    if (isNaN(w) || w <= 0) return
    updateEntry(editTarget.id, w, editNote || undefined)
    setEditSaved(true)
    setTimeout(() => {
      setEditTarget(null)
      setEditSaved(false)
    }, 800)
  }

  function handleDeleteEntry() {
    if (!editTarget) return
    if (!confirm('Delete this entry? This cannot be undone.')) return
    removeEntry(editTarget.id)
    setEditTarget(null)
  }

  function handleSaveSettings(e?: React.FormEvent) {
    e?.preventDefault()
    const totalIn =
      heightFt !== '' && heightInVal !== ''
        ? Number(heightFt) * 12 + Number(heightInVal)
        : null
    updateUser(user.id, {
      goalWeight: parseFloat(goalW) || null,
      startingWeight: parseFloat(startW) || null,
      heightIn: totalIn,
      gender: (gender || null) as Gender | null,
      weekStartDay: weekStartDay as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }

  async function handleSync() {
    const cfg: GitHubConfig = { token: ghToken.trim(), repo: ghRepo.trim() }
    if (!cfg.token || !cfg.repo) return

    setIsSyncing(true)
    setSyncError(null)

    try {
      // 1. Pull remote users
      const { users: remoteUsers, sha: usersSha } = await fetchUsers(cfg)

      // 2. Pull remote entries for every known user (local + remote)
      const { users: localUsers, entries: localEntries } = useAppStore.getState()
      const allUserIds = new Set([
        ...localUsers.map((u) => u.id),
        ...remoteUsers.map((u) => u.id),
      ])

      const remoteEntries = []
      const entryShas: Record<string, string | null> = {}
      for (const uid of allUserIds) {
        const { entries: ue, sha } = await fetchEntries(cfg, uid)
        remoteEntries.push(...ue)
        entryShas[uid] = sha
      }

      // 3. Merge remote into local store
      mergeData(remoteUsers, remoteEntries)

      // 4. Push merged state back to GitHub
      const merged = useAppStore.getState()
      await pushUsers(cfg, merged.users, usersSha)
      for (const u of merged.users) {
        const ue = merged.entries.filter((e) => e.userId === u.id)
        await pushEntries(cfg, u.id, ue, entryShas[u.id] ?? null, u.name)
      }

      // 5. Persist config + timestamp
      const now = new Date()
      storage.saveGitHubConfig({
        token: cfg.token,
        repo: cfg.repo,
        lastSynced: now.toISOString(),
      })
      setLastSynced(now)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <span className="page-subtitle">{user.emoji} {user.name}</span>
        </div>
        <div className="header-actions">
          <button
            className={`btn-icon${settingsSaved ? ' btn-icon--saved' : settingsDirty ? ' btn-icon--pulse' : ''}`}
            onClick={() => handleSaveSettings()}
            aria-label="Save settings"
            title="Save settings"
          >
            {settingsSaved ? '✓' : <FloppyIcon />}
          </button>
          {ghToken.trim() && (
            <button
              className="btn-sync"
              onClick={handleSync}
              disabled={isSyncing || !ghToken.trim() || !ghRepo.trim()}
              aria-label="Sync with GitHub"
            >
              {isSyncing ? '…' : '↻'}
            </button>
          )}
        </div>
      </header>

      {/* ── Body & Goals ── */}
      <section className="section">
        <div className="section-title">Body &amp; Goals</div>
        <form className="form" onSubmit={handleSaveSettings}>

          {/* Height */}
          <div className="form-group">
            <label className="form-label">Height</label>
            <div className="height-row">
              <input
                type="number" inputMode="numeric" min="3" max="8"
                placeholder="5"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
                className="form-input form-input--sm"
              />
              <span className="height-unit">ft</span>
              <input
                type="number" inputMode="numeric" min="0" max="11"
                placeholder="10"
                value={heightInVal}
                onChange={(e) => setHeightInVal(e.target.value)}
                className="form-input form-input--sm"
              />
              <span className="height-unit">in</span>
            </div>
          </div>

          {/* Gender */}
          <div className="form-group">
            <label className="form-label">Gender</label>
            <div className="gender-row">
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <button
                  key={g} type="button"
                  className={`gender-btn ${gender === g ? 'gender-btn--active' : ''}`}
                  onClick={() => setGender((prev) => (prev === g ? '' : g))}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Starting / Goal weight */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Starting weight (lbs)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                className="form-input"
                placeholder="200"
                value={startW}
                onChange={(e) => setStartW(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Goal weight (lbs)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                className="form-input"
                placeholder="170"
                value={goalW}
                onChange={(e) => setGoalW(e.target.value)}
              />
            </div>
          </div>

          {/* Week start day */}
          <div className="form-group">
            <label className="form-label">Week starts on</label>
            <div className="day-picker">
              {DAY_LABELS.map((label, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`day-btn${weekStartDay === idx ? ' day-btn--active' : ''}`}
                  onClick={() => setWeekStartDay(idx)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className={`btn btn--primary btn--full ${settingsSaved ? 'btn--saved' : ''}`}
          >
            {settingsSaved ? 'Saved ✓' : 'Save Settings'}
          </button>
        </form>
      </section>

      {/* ── Modify values ── */}
      <section className="section">
        <div className="section-title">Modify values</div>

        {userEntries.length === 0 ? (
          <p className="empty-state">No entries yet.</p>
        ) : (
          <ul className="entry-scroll-list">
            {userEntries.map((entry) => (
              <li key={entry.id}>
                <button
                  className="entry-item"
                  style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onClick={() => openEdit(entry)}
                >
                  <div className="entry-item__date">
                    <div className="entry-item__date-main">{formatDisplayDate(entry.date)}</div>
                    <div className="entry-item__date-day">{formatDayName(entry.date)}</div>
                  </div>
                  <span className="entry-item__weight">
                    {entry.weight.toFixed(1)} {user.unit}
                  </span>
                  <span className="entry-item__chevron">›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── GitHub Sync ── */}
      <section className="section">
        <div className="section-title">GitHub Sync</div>
        <p className="sync-hint">
          Syncs all family members' data through your GitHub repo.
          Each save creates a real git commit — full history included.
        </p>

        <div className="form">
          <div className="form-group">
            <label className="form-label">Repository</label>
            <input
              type="text"
              className="form-input"
              placeholder="owner/repo"
              value={ghRepo}
              onChange={(e) => setGhRepo(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Personal Access Token
              <a
                className="form-label__link"
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create token ↗
              </a>
            </label>
            <div className="token-input-row">
              <input
                type={showToken ? 'text' : 'password'}
                className="form-input"
                placeholder="ghp_xxxxxxxxxxxx"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? 'Hide token' : 'Show token'}
              >
                {showToken ? '🙈' : '👁'}
              </button>
            </div>
            <p className="form-hint">
              Fine-grained PAT · Contents: Read &amp; Write · this repo only
            </p>
          </div>

          <button
            type="button"
            className="btn btn--primary btn--full"
            onClick={handleSync}
            disabled={isSyncing || !ghToken.trim() || !ghRepo.trim()}
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </button>

          {syncError && (
            <p className="sync-error">{syncError}</p>
          )}
          {!syncError && lastSynced && (
            <p className="sync-ok">Last synced {formatRelative(lastSynced)}</p>
          )}
        </div>
      </section>

      {/* ── Edit sheet ── */}
      {editTarget && (
        <div
          className="sheet-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setEditTarget(null) }}
        >
          <div className="sheet" role="dialog" aria-modal="true">
            <div className="sheet-handle" />
            <div className="edit-entry-form">
              <div className="edit-entry-date">{formatDisplayDate(editTarget.date)}</div>
              <div className="edit-entry-weight">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  className="edit-weight-input"
                  value={editWeight}
                  onChange={(e) => setEditWeight(e.target.value)}
                  autoFocus
                />
                <span className="edit-weight-unit">{user.unit}</span>
              </div>

              <div className="form-group">
                <label className="form-label">Note <span className="form-label__optional">(optional)</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. morning, after workout"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  maxLength={120}
                />
              </div>

              <div className="edit-entry-actions">
                <button className="btn btn--danger btn--sm" onClick={handleDeleteEntry}>
                  Delete
                </button>
                <button
                  className={`btn ${editSaved ? 'btn--saved' : 'btn--primary'} btn--full`}
                  onClick={handleSaveEntry}
                >
                  {editSaved ? 'Saved ✓' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long' })
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
