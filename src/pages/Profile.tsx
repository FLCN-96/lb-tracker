import { useState } from 'react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import type { WeightUnit } from '@/types'

export default function Profile() {
  const users = useAppStore((s) => s.users)
  const activeUserId = useAppStore((s) => s.activeUserId)
  const addUser = useAppStore((s) => s.addUser)
  const updateUser = useAppStore((s) => s.updateUser)
  const removeUser = useAppStore((s) => s.removeUser)
  const setActiveUser = useAppStore((s) => s.setActiveUser)
  const activeUser = useAppStore(selectActiveUser)

  const [showAddForm, setShowAddForm] = useState(false)

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Profile</h1>
      </header>

      {/* ── Active user edit ── */}
      {activeUser && (
        <section className="section">
          <h2 className="section-title">Your Profile</h2>
          <EditUserForm
            user={activeUser}
            onSave={(patch) => updateUser(activeUser.id, patch)}
          />
        </section>
      )}

      {/* ── Other members ── */}
      {users.length > 1 && (
        <section className="section">
          <h2 className="section-title">Members</h2>
          <ul className="user-list">
            {users.map((u) => (
              <li key={u.id} className="user-row">
                <button
                  className={`user-row__name ${u.id === activeUserId ? 'user-row__name--active' : ''}`}
                  onClick={() => setActiveUser(u.id)}
                >
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
            <h2 className="section-title">Add Member</h2>
            <AddUserForm
              onSave={(name, unit, start, goal) => {
                addUser(name, unit, start, goal)
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
  const [unit, setUnit] = useState<WeightUnit>(user.unit)
  const [startW, setStartW] = useState(user.startingWeight?.toString() ?? '')
  const [goalW, setGoalW] = useState(user.goalWeight?.toString() ?? '')
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name: name.trim() || user.name,
      unit,
      startingWeight: parseFloat(startW) || null,
      goalWeight: parseFloat(goalW) || null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="edit-name" className="form-label">Name</label>
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

      <div className="form-group">
        <label className="form-label">Unit</label>
        <div className="segmented">
          {(['lbs', 'kg'] as WeightUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              className={`segmented__btn ${unit === u ? 'segmented__btn--active' : ''}`}
              onClick={() => setUnit(u)}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="edit-start" className="form-label">Starting weight</label>
          <input
            id="edit-start"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={unit === 'lbs' ? '200' : '90'}
            value={startW}
            onChange={(e) => setStartW(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="edit-goal" className="form-label">Goal weight</label>
          <input
            id="edit-goal"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={unit === 'lbs' ? '170' : '77'}
            value={goalW}
            onChange={(e) => setGoalW(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      <button type="submit" className={`btn btn--primary btn--full ${saved ? 'btn--saved' : ''}`}>
        {saved ? 'Saved ✓' : 'Save Changes'}
      </button>
    </form>
  )
}

// ─── Add new user ─────────────────────────────────────────────────────────────

function AddUserForm({
  onSave,
  onCancel,
}: {
  onSave: (name: string, unit: WeightUnit, start?: number, goal?: number) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<WeightUnit>('lbs')
  const [startW, setStartW] = useState('')
  const [goalW, setGoalW] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    onSave(
      name.trim(),
      unit,
      parseFloat(startW) || undefined,
      parseFloat(goalW) || undefined,
    )
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="add-name" className="form-label">Name</label>
        <input
          id="add-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
          placeholder="e.g. Alex"
          maxLength={40}
          autoFocus
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Unit</label>
        <div className="segmented">
          {(['lbs', 'kg'] as WeightUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              className={`segmented__btn ${unit === u ? 'segmented__btn--active' : ''}`}
              onClick={() => setUnit(u)}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="add-start" className="form-label">Starting weight <span className="form-label__optional">(opt)</span></label>
          <input
            id="add-start"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={unit === 'lbs' ? '200' : '90'}
            value={startW}
            onChange={(e) => setStartW(e.target.value)}
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="add-goal" className="form-label">Goal weight <span className="form-label__optional">(opt)</span></label>
          <input
            id="add-goal"
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={unit === 'lbs' ? '170' : '77'}
            value={goalW}
            onChange={(e) => setGoalW(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-row form-row--actions">
        <button type="button" className="btn btn--ghost btn--full" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary btn--full">
          Add Member
        </button>
      </div>
    </form>
  )
}
