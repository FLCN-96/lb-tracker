import { useState } from 'react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'

type EditTarget = { id: string; date: string; weight: number; note: string | null }

export default function Settings() {
  const user = useAppStore(selectActiveUser)
  const entries = useAppStore((s) => s.entries)
  const updateUser = useAppStore((s) => s.updateUser)
  const updateEntry = useAppStore((s) => s.updateEntry)
  const removeEntry = useAppStore((s) => s.removeEntry)

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editWeight, setEditWeight] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editSaved, setEditSaved] = useState(false)

  // Goal settings
  const [goalW, setGoalW] = useState(user?.goalWeight?.toString() ?? '')
  const [startW, setStartW] = useState(user?.startingWeight?.toString() ?? '')
  const [settingsSaved, setSettingsSaved] = useState(false)

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

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    updateUser(user.id, {
      goalWeight: parseFloat(goalW) || null,
      startingWeight: parseFloat(startW) || null,
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 1500)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <span className="page-subtitle">{user.emoji} {user.name}</span>
      </header>

      {/* ── Goal / unit settings ── */}
      <section className="section">
        <div className="section-title">Your goals</div>
        <form className="form" onSubmit={handleSaveSettings}>
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
