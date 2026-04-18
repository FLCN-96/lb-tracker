import { useState, useEffect, useMemo } from 'react'
import { Save, RefreshCw, Check } from 'lucide-react'
import { toast } from '@/components/ui/Toaster'
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

type ModalView =
  | { kind: 'list' }
  | { kind: 'edit'; id: string; date: string; weight: number }

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export default function Settings() {
  const user = useAppStore(selectActiveUser)
  const entries = useAppStore((s) => s.entries)
  const updateUser = useAppStore((s) => s.updateUser)
  const addEntry = useAppStore((s) => s.addEntry)
  const updateEntry = useAppStore((s) => s.updateEntry)
  const removeEntry = useAppStore((s) => s.removeEntry)
  const mergeData = useAppStore((s) => s.mergeData)

  const [entriesModal, setEntriesModal] = useState<ModalView | null>(null)
  const [editWeight, setEditWeight] = useState('')
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
  const [syncVersion, setSyncVersion] = useState(0)

  // Mass import
  const [importText, setImportText] = useState('')
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null)

  // Export (flash replaced by toast — keep state for clipboard copy only)
  const [copyFlash, setCopyFlash] = useState(false)

  // Keep form in sync when the store is updated externally (e.g. after a sync).
  // syncVersion is bumped after every sync so the form resets even when the
  // stored values didn't change (e.g. unsaved edits get discarded on sync).
  useEffect(() => {
    if (!user) return
    setGoalW(user.goalWeight?.toString() ?? '')
    setStartW(user.startingWeight?.toString() ?? '')
    setHeightFt(user.heightIn ? String(Math.floor(user.heightIn / 12)) : '')
    setHeightInVal(user.heightIn ? String(user.heightIn % 12) : '')
    setGender(user.gender ?? '')
    setWeekStartDay(user.weekStartDay ?? 1)
  }, [
    user?.goalWeight,
    user?.startingWeight,
    user?.heightIn,
    user?.gender,
    user?.weekStartDay,
    syncVersion,
  ])

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

  // Group by month key "YYYY-MM", sorted newest first
  const entryMonths = useMemo(() => {
    const groups = new Map<string, typeof userEntries>()
    for (const e of userEntries) {
      const key = e.date.slice(0, 7)
      groups.set(key, [...(groups.get(key) ?? []), e])
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [userEntries])

  function openEdit(e: { id: string; date: string; weight: number }) {
    setEntriesModal({ kind: 'edit', id: e.id, date: e.date, weight: e.weight })
    setEditWeight(String(e.weight))
    setEditSaved(false)
  }

  function handleSaveEntry() {
    if (!entriesModal || entriesModal.kind !== 'edit') return
    const w = parseFloat(editWeight)
    if (isNaN(w) || w < 20 || w > 1500) return
    updateEntry(entriesModal.id, w)
    setEditSaved(true)
    setTimeout(() => {
      setEntriesModal({ kind: 'list' })
      setEditSaved(false)
    }, 700)
  }

  function handleDeleteEntry() {
    if (!entriesModal || entriesModal.kind !== 'edit') return
    if (!confirm('Delete this entry? This cannot be undone.')) return
    removeEntry(entriesModal.id)
    setEntriesModal({ kind: 'list' })
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

  function handleImport() {
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean)
    let added = 0
    let skipped = 0
    for (const line of lines) {
      const comma = line.indexOf(',')
      if (comma === -1) { skipped++; continue }
      const datePart = line.slice(0, comma).trim()
      const weightPart = line.slice(comma + 1).trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) { skipped++; continue }
      const w = parseFloat(weightPart)
      if (isNaN(w) || w < 20 || w > 1500) { skipped++; continue }
      addEntry(user.id, w, datePart)
      added++
    }
    setImportResult({ added, skipped })
    if (added > 0) setImportText('')
  }

  async function handleSync() {
    const cfg: GitHubConfig = { token: ghToken.trim(), repo: ghRepo.trim() }
    if (!cfg.token || !cfg.repo) return

    setIsSyncing(true)
    setSyncError(null)

    try {
      // 1. Pull remote users
      const { users: remoteUsers, sha: usersSha } = await fetchUsers(cfg)

      // 2. Filter out tombstoned (locally deleted) users so they aren't revived
      const tombstones = new Set(storage.loadDeletedUserIds())
      const filteredRemoteUsers = remoteUsers.filter((u) => !tombstones.has(u.id))

      // 3. Pull remote entries for every known user (local + non-tombstoned remote)
      const { users: localUsers } = useAppStore.getState()
      const allUserIds = new Set([
        ...localUsers.map((u) => u.id),
        ...filteredRemoteUsers.map((u) => u.id),
      ])

      const remoteEntries = []
      const entryShas: Record<string, string | null> = {}
      for (const uid of allUserIds) {
        const { entries: ue, sha } = await fetchEntries(cfg, uid)
        remoteEntries.push(...ue)
        entryShas[uid] = sha
      }

      // 4. Merge remote into local store (tombstoned users excluded)
      mergeData(filteredRemoteUsers, remoteEntries.filter((e) => !tombstones.has(e.userId)))

      // 5. Push merged state back to GitHub
      const merged = useAppStore.getState()
      await pushUsers(cfg, merged.users, usersSha)
      for (const u of merged.users) {
        const ue = merged.entries.filter((e) => e.userId === u.id)
        await pushEntries(cfg, u.id, ue, entryShas[u.id] ?? null, u.name)
      }

      // 6. Persist config + timestamp; clear tombstones now that deletion is pushed
      storage.saveDeletedUserIds([])
      const now = new Date()
      storage.saveGitHubConfig({
        token: cfg.token,
        repo: cfg.repo,
        lastSynced: now.toISOString(),
      })
      setLastSynced(now)
      setSyncVersion((v) => v + 1)
      toast.success('Synced with GitHub')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
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
            {settingsSaved ? <Check size={15} strokeWidth={2.5} /> : <Save size={15} strokeWidth={2} />}
          </button>
          {ghToken.trim() && (
            <button
              className="btn-sync"
              onClick={handleSync}
              disabled={isSyncing || !ghToken.trim() || !ghRepo.trim()}
              aria-label="Sync with GitHub"
              style={isSyncing ? { animation: 'btn-sync-spin 0.7s linear infinite' } : undefined}
            >
              <RefreshCw size={15} strokeWidth={2.2} />
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
          <button
            className="btn btn--ghost btn--full"
            onClick={() => setEntriesModal({ kind: 'list' })}
          >
            View all {userEntries.length} entr{userEntries.length === 1 ? 'y' : 'ies'}
          </button>
        )}
      </section>

      {/* ── Export Records ── */}
      <section className="section">
        <div className="section-title">Export Records</div>
        {userEntries.length === 0 ? (
          <p className="empty-state">No entries to export yet.</p>
        ) : (
          <>
            <p className="sync-hint">
              Your {userEntries.length} entr{userEntries.length === 1 ? 'y' : 'ies'} in <code>yyyy-mm-dd,weight</code> format — ready to copy or paste elsewhere.
            </p>
            <textarea
              className="import-textarea"
              rows={6}
              readOnly
              spellCheck={false}
              value={[...userEntries]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((e) => `${e.date},${e.weight}`)
                .join('\n')}
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className={`btn btn--full ${copyFlash ? 'btn--saved' : 'btn--secondary'}`}
              style={{ marginTop: 8 }}
              onClick={() => {
                const text = [...userEntries]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((e) => `${e.date},${e.weight}`)
                  .join('\n')
                navigator.clipboard.writeText(text).then(() => {
                  setCopyFlash(true)
                  setTimeout(() => setCopyFlash(false), 2000)
                })
              }}
            >
              {copyFlash ? 'Copied ✓' : 'Copy to Clipboard'}
            </button>
          </>
        )}
      </section>

      {/* ── Mass Import ── */}
      <section className="section">
        <div className="section-title">Import Records</div>
        <p className="sync-hint">
          Paste one record per line in the format <code>yyyy-mm-dd,weight</code>:
        </p>
        <textarea
          className="import-textarea"
          rows={6}
          spellCheck={false}
          placeholder={`2025-01-20,234.6\n2025-01-27,234.4\n2025-02-03,233.1`}
          value={importText}
          onChange={(e) => { setImportText(e.target.value); setImportResult(null) }}
        />
        <button
          type="button"
          className="btn btn--primary btn--full"
          style={{ marginTop: 8 }}
          onClick={handleImport}
          disabled={!importText.trim()}
        >
          Import
        </button>
        {importResult && (
          <p className={importResult.added > 0 ? 'sync-ok' : 'sync-error'} style={{ marginTop: 8 }}>
            {importResult.added > 0
              ? `Imported ${importResult.added} entr${importResult.added === 1 ? 'y' : 'ies'}${importResult.skipped > 0 ? ` · ${importResult.skipped} skipped` : ''}`
              : `Nothing imported · ${importResult.skipped} line${importResult.skipped === 1 ? '' : 's'} couldn't be parsed`}
          </p>
        )}
      </section>

      {/* ── Data Source ── */}
      <section className="section">
        <div className="section-title">Data Source</div>
        <DataSourceStatus stored={stored} lastSynced={lastSynced} />
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

          {lastSynced && (
            <p className="sync-ok">Last synced {formatRelative(lastSynced)}</p>
          )}
        </div>
      </section>

      {/* ── Entries modal (list → edit) ── */}
      {entriesModal && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setEntriesModal(null) }}
        >
          <div className="modal-dialog modal-dialog--tall" role="dialog" aria-modal="true">

            {entriesModal.kind === 'list' ? (
              <>
                <h2 className="sheet-title">All Entries</h2>
                <div className="entries-modal-list">
                  {entryMonths.map(([monthKey, monthEntries]) => (
                    <div key={monthKey}>
                      <div className="entries-month-header">{formatMonth(monthKey)}</div>
                      {monthEntries.map((e) => (
                        <button
                          key={e.id}
                          className="entry-item"
                          onClick={() => openEdit(e)}
                        >
                          <div className="entry-item__date">
                            <div className="entry-item__date-main">{formatDisplayDate(e.date)}</div>
                            <div className="entry-item__date-day">{formatDayName(e.date)}</div>
                          </div>
                          <span className="entry-item__weight">{e.weight.toFixed(1)} {user.unit}</span>
                          <span className="entry-item__chevron">›</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
                <button className="btn btn--ghost btn--full" onClick={() => setEntriesModal(null)}>
                  Close
                </button>
              </>
            ) : (
              <>
                <h2 className="sheet-title">{formatDisplayDate(entriesModal.date)}</h2>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {formatDayName(entriesModal.date)}
                </p>
                <div className="edit-entry-weight" style={{ marginBottom: 20 }}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="20"
                    max="1500"
                    className="edit-weight-input"
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    autoFocus
                  />
                  <span className="edit-weight-unit">{user.unit}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn--danger" onClick={handleDeleteEntry}>Delete</button>
                  <button className="btn btn--ghost" onClick={() => setEntriesModal({ kind: 'list' })}>← Back</button>
                  <button
                    className={`btn btn--full ${editSaved ? 'btn--saved' : 'btn--primary'}`}
                    onClick={handleSaveEntry}
                  >
                    {editSaved ? 'Saved ✓' : 'Save'}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

// ─── Data source status card ──────────────────────────────────────────────────

function DataSourceStatus({
  stored,
  lastSynced,
}: {
  stored: import('@/services/storage').StoredGitHubConfig | null
  lastSynced: Date | null
}) {
  const hasGitHub = !!(stored?.token && stored?.repo)
  const staleMins  = lastSynced ? Math.floor((Date.now() - lastSynced.getTime()) / 60_000) : null
  const staleHrs   = staleMins  !== null ? Math.floor(staleMins / 60) : null
  const isStale    = staleHrs   !== null && staleHrs >= 24

  type Badge = 'ok' | 'warn' | 'local'
  type NoteKind = 'caution' | 'tip' | 'sec'
  interface Note { kind: NoteKind; text: string }

  let badge: Badge
  let statusLabel: string
  let statusDetail: string
  const notes: Note[] = []

  if (!hasGitHub) {
    badge = 'local'
    statusLabel = 'Local storage only'
    statusDetail = 'Data exists only on this device'
    notes.push(
      { kind: 'caution', text: 'All entries are stored in your browser\'s local storage. Clearing browser data or "Clear site data" permanently erases everything — there is no recovery.' },
      { kind: 'caution', text: 'Opening this app in a different browser, device, or profile will show no data.' },
      { kind: 'caution', text: 'Reinstalling the app or switching browsers also starts from scratch.' },
      { kind: 'tip',     text: 'Configure GitHub Sync below to create an automatic off-device backup after every change.' },
    )
  } else if (!lastSynced) {
    badge = 'warn'
    statusLabel = 'Not yet synced'
    statusDetail = 'GitHub configured · first sync pending'
    notes.push(
      { kind: 'caution', text: 'Data is still local-only until the first sync completes. Don\'t clear browser storage before syncing.' },
      { kind: 'tip',     text: 'Tap "Sync Now" below to push your entries to GitHub and activate cloud backup.' },
    )
  } else if (isStale) {
    badge = 'warn'
    statusLabel = 'Sync outdated'
    statusDetail = `Last synced ${formatRelative(lastSynced)}`
    notes.push(
      { kind: 'caution', text: 'Other devices may have logged new entries since the last sync. Sync before adding data here to avoid overwriting newer records.' },
      { kind: 'tip',     text: 'The app works fully offline — entries added without internet stay local until the next successful sync.' },
      { kind: 'tip',     text: 'Always sync when switching between devices.' },
    )
  } else {
    badge = 'ok'
    statusLabel = 'Cloud synced'
    statusDetail = `Last synced ${formatRelative(lastSynced)}`
    notes.push(
      { kind: 'tip',  text: 'The app works fully offline. Entries added without internet stay local until the next sync.' },
      { kind: 'tip',  text: 'Always sync before switching to a different device — unsynced local changes are not visible elsewhere.' },
      { kind: 'sec',  text: 'Your Personal Access Token grants write access to the configured repo. Treat it like a password and don\'t share it.' },
    )
  }

  const iconFor = (kind: NoteKind) => kind === 'caution' ? '▲' : kind === 'sec' ? '⚿' : '›'

  return (
    <div className="ds-card">
      <div className="ds-status-row">
        <span className={`ds-badge ds-badge--${badge}`}>{statusLabel}</span>
        <span className="ds-detail">{statusDetail}</span>
      </div>
      <ul className="ds-notes">
        {notes.map((n, i) => (
          <li key={i} className={`ds-note ds-note--${n.kind}`}>
            <span className="ds-note__icon">{iconFor(n.kind)}</span>
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
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
