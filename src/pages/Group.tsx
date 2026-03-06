import { useState, useCallback } from 'react'

function FloppyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/>
      <polyline points="7,3 7,8 15,8"/>
    </svg>
  )
}
import { useGroupSnapshot } from '@/hooks/useWeightData'
import { useAppStore } from '@/store/useAppStore'
import { formatWeight, formatDelta } from '@/utils/weightCalc'
import { storage } from '@/services/storage'
import { fetchUsers, fetchEntries, pushUsers, pushEntries } from '@/services/github'
import { AVAILABLE_EMOJIS } from '@/types'
import type { UserEmoji } from '@/types'

export default function Group() {
  const members = useGroupSnapshot()
  const users = useAppStore((s) => s.users)
  const entries = useAppStore((s) => s.entries)
  const activeUserId = useAppStore((s) => s.activeUserId)
  const setActiveUser = useAppStore((s) => s.setActiveUser)
  const addUser = useAppStore((s) => s.addUser)
  const removeUser = useAppStore((s) => s.removeUser)
  const mergeData = useAppStore((s) => s.mergeData)
  const deduplicate = useAppStore((s) => s.deduplicate)

  const [showAdd, setShowAdd] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncFlash, setSyncFlash] = useState<'ok' | 'err' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveFlash, setSaveFlash] = useState<'ok' | 'err' | null>(null)

  const ghConfig = storage.loadGitHubConfig()

  // Shared bidirectional sync: fetch remote, merge with local, push combined.
  // Safe for both buttons — local-only entries are never discarded.
  async function syncWithGitHub() {
    const cfg = { token: ghConfig!.token, repo: ghConfig!.repo }
    const { users: remoteUsers, sha: usersSha } = await fetchUsers(cfg)
    const { users: localUsers } = useAppStore.getState()
    const allIds = new Set([...localUsers.map((u) => u.id), ...remoteUsers.map((u) => u.id)])
    const remoteEntries: import('@/types').WeightEntry[] = []
    const entryShas: Record<string, string | null> = {}
    for (const uid of allIds) {
      const { entries: ue, sha } = await fetchEntries(cfg, uid)
      remoteEntries.push(...ue)
      entryShas[uid] = sha
    }
    mergeData(remoteUsers, remoteEntries)
    const merged = useAppStore.getState()
    await pushUsers(cfg, merged.users, usersSha)
    for (const u of merged.users) {
      const ue = merged.entries.filter((e) => e.userId === u.id)
      await pushEntries(cfg, u.id, ue, entryShas[u.id] ?? null, u.name)
    }
    storage.saveGitHubConfig({ ...ghConfig, lastSynced: new Date().toISOString() })
  }

  async function handleSave() {
    if (!ghConfig?.token) return
    setSaving(true)
    setSaveFlash(null)
    try {
      await syncWithGitHub()
      setSaveFlash('ok')
      setTimeout(() => setSaveFlash(null), 2000)
    } catch {
      setSaveFlash('err')
      setTimeout(() => setSaveFlash(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleSync() {
    if (!ghConfig?.token) return
    setSyncing(true)
    setSyncFlash(null)
    try {
      await syncWithGitHub()
      setSyncFlash('ok')
      setTimeout(() => setSyncFlash(null), 2500)
    } catch {
      setSyncFlash('err')
      setTimeout(() => setSyncFlash(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  function handleRemove(userId: string, userName: string) {
    if (window.confirm(`Remove ${userName}? This deletes all their weight entries.`)) {
      removeUser(userId)
    }
  }

  return (
    <div className="page">
      {/* ── Header ── */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Group</h1>
          <span className="page-subtitle">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
        </div>

        {ghConfig?.token && (
          <div className="header-actions">
            <button
              className={`btn-icon${saveFlash === 'ok' ? ' btn-icon--saved' : saveFlash === 'err' ? ' btn-icon--err' : ''}`}
              onClick={handleSave}
              disabled={saving}
              aria-label="Push members to GitHub"
              title="Save to GitHub"
            >
              {saving ? '…' : saveFlash === 'ok' ? '✓' : <FloppyIcon />}
            </button>
            <button
              className={`btn-sync${syncing ? ' btn-sync--spin' : ''}${
                syncFlash === 'ok' ? ' btn-sync--ok' : syncFlash === 'err' ? ' btn-sync--err' : ''
              }`}
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sync with GitHub"
              title="Sync with GitHub"
            >
              ↻
            </button>
          </div>
        )}
      </header>

      {/* ── Member list ── */}
      {members.length === 0 ? (
        <p className="empty-state" style={{ padding: '24px 0' }}>
          No members yet. Add one below.
        </p>
      ) : (
        <ul className="member-list">
          {members.map(({ user, currentWeek }) => (
            <li
              key={user.id}
              className={`member-card ${user.id === activeUserId ? 'member-card--active' : ''}`}
            >
              {/* Avatar + info — clickable to switch active user */}
              <button
                className="member-card__main"
                onClick={() => setActiveUser(user.id)}
                aria-pressed={user.id === activeUserId}
              >
                <div className="member-avatar">{user.emoji}</div>
                <div className="member-info">
                  <span className="member-name">{user.name}</span>
                  <span className="member-unit">{user.unit}</span>
                </div>
                <div className="member-stats">
                  {currentWeek ? (
                    <>
                      <span className="member-avg">
                        {formatWeight(currentWeek.average, user.unit)}
                      </span>
                      <span
                        className={`member-delta ${
                          currentWeek.delta === null
                            ? ''
                            : currentWeek.delta < 0
                            ? 'delta--down'
                            : currentWeek.delta > 0
                            ? 'delta--up'
                            : ''
                        }`}
                      >
                        {formatDelta(currentWeek.delta, user.unit)}
                      </span>
                    </>
                  ) : (
                    <span className="member-no-data">No data</span>
                  )}
                </div>
              </button>

              {/* Remove button (not for active user) */}
              {user.id !== activeUserId && (
                <button
                  className="member-card__remove"
                  onClick={() => handleRemove(user.id, user.name)}
                  aria-label={`Remove ${user.name}`}
                  title="Remove member"
                >
                  ✕
                </button>
              )}

              {user.id === activeUserId && (
                <span className="member-card__active-badge">Active</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ── Add member ── */}
      <section className="section" style={{ marginTop: 8 }}>
        {showAdd ? (
          <>
            <div className="section-title">Add Member</div>
            <AddMemberForm
              usedEmojis={new Set(users.map((u) => u.emoji))}
              onSave={(name, emoji) => {
                const existing = users.find(
                  (u) => u.name.toLowerCase() === name.toLowerCase(),
                )
                if (existing) {
                  setActiveUser(existing.id)
                } else {
                  addUser(name, emoji, 'lbs')
                }
                setShowAdd(false)
              }}
              onCancel={() => setShowAdd(false)}
            />
          </>
        ) : (
          <button className="btn btn--secondary btn--full" onClick={() => setShowAdd(true)}>
            + Add Member
          </button>
        )}
      </section>

      {/* ── Utility ── */}
      {users.length > 1 && (
        <section className="section">
          <button
            className="btn btn--ghost btn--full"
            style={{ fontSize: 12 }}
            onClick={() => {
              deduplicate()
            }}
          >
            De-duplicate members
          </button>
        </section>
      )}

      {ghConfig?.lastSynced && (
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', paddingBottom: 8 }}>
          Last synced: {new Date(ghConfig.lastSynced).toLocaleString()}
        </p>
      )}
    </div>
  )
}

// ─── Add member inline form ───────────────────────────────────────────────────

function AddMemberForm({
  usedEmojis,
  onSave,
  onCancel,
}: {
  usedEmojis: Set<string>
  onSave: (name: string, emoji: UserEmoji) => void
  onCancel: () => void
}) {
  const available = AVAILABLE_EMOJIS.filter((e) => !usedEmojis.has(e))
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState<UserEmoji | null>(available[0] ?? null)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required.'); return }
    if (!emoji) { setError('No emoji slots available.'); return }
    onSave(name.trim(), emoji)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Pick emoji</label>
        <div className="emoji-grid" style={{ gridTemplateColumns: `repeat(${Math.min(available.length, 6)}, 1fr)` }}>
          {available.map((e) => (
            <button
              key={e}
              type="button"
              className={`emoji-opt ${emoji === e ? 'emoji-opt--selected' : ''}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="add-name" className="form-label">Name</label>
        <input
          id="add-name"
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          className="form-input"
          placeholder="e.g. Alex"
          maxLength={40}
          autoFocus
          required
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-row form-row--actions">
        <button type="button" className="btn btn--ghost btn--full" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn--primary btn--full">Add</button>
      </div>
    </form>
  )
}
