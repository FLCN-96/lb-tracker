import { useState } from 'react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import { AVAILABLE_EMOJIS } from '@/types'
import type { UserEmoji } from '@/types'

export default function Profile() {
  const users = useAppStore((s) => s.users)
  const activeUserId = useAppStore((s) => s.activeUserId)
  const addUser = useAppStore((s) => s.addUser)
  const updateUser = useAppStore((s) => s.updateUser)
  const removeUser = useAppStore((s) => s.removeUser)
  const setActiveUser = useAppStore((s) => s.setActiveUser)
  const activeUser = useAppStore(selectActiveUser)

  const [showAddForm, setShowAddForm] = useState(false)

  if (!activeUser) {
    return (
      <div className="page page--centered">
        <p className="empty-state">No profile selected.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Profile</h1>
        <span className="page-subtitle">{activeUser.emoji} {activeUser.name}</span>
      </header>

      {/* ── Edit active profile ── */}
      <section className="section">
        <div className="section-title">Your profile</div>
        <EditUserForm
          user={activeUser}
          onSave={(patch) => updateUser(activeUser.id, patch)}
        />
      </section>

      {/* ── Switch / remove members ── */}
      {users.length > 1 && (
        <section className="section">
          <div className="section-title">Members</div>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id} className="user-row">
                <button
                  className={`user-row__name ${u.id === activeUserId ? 'user-row__name--active' : ''}`}
                  onClick={() => setActiveUser(u.id)}
                >
                  <span>{u.emoji}</span>
                  {u.name}
                  {u.id === activeUserId && <span className="badge">Active</span>}
                </button>
                {u.id !== activeUserId && (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      if (confirm(`Remove ${u.name}? This deletes all their entries.`)) {
                        removeUser(u.id)
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Add member ── */}
      <section className="section">
        {showAddForm ? (
          <>
            <div className="section-title">Add member</div>
            <AddUserForm
              usedEmojis={new Set(users.map((u) => u.emoji))}
              onSave={(name, emoji, unit) => {
                addUser(name, emoji, unit)
                setShowAddForm(false)
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </>
        ) : (
          <button className="btn btn--secondary btn--full" onClick={() => setShowAddForm(true)}>
            + Add Member
          </button>
        )}
      </section>
    </div>
  )
}

// ─── Edit existing user ───────────────────────────────────────────────────────

function EditUserForm({
  user,
  onSave,
}: {
  user: import('@/types').User
  onSave: (patch: Partial<Omit<import('@/types').User, 'id' | 'createdAt'>>) => void
}) {
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({ name: name.trim() || user.name })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="edit-name" className="form-label">Display name</label>
        <input
          id="edit-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          maxLength={40}
          required
        />
      </div>

      <button type="submit" className={`btn btn--primary btn--full ${saved ? 'btn--saved' : ''}`}>
        {saved ? 'Saved ✓' : 'Save Changes'}
      </button>
    </form>
  )
}

// ─── Add new user ─────────────────────────────────────────────────────────────

function AddUserForm({
  usedEmojis,
  onSave,
  onCancel,
}: {
  usedEmojis: Set<string>
  onSave: (name: string, emoji: UserEmoji, unit: 'lbs') => void
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
    onSave(name.trim(), emoji, 'lbs')
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
        <button type="submit" className="btn btn--primary btn--full">Add Member</button>
      </div>
    </form>
  )
}
