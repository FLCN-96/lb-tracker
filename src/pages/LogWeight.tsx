import { useState } from 'react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import { todayStr } from '@/utils/weightCalc'

export default function LogWeight() {
  const user = useAppStore(selectActiveUser)
  const addEntry = useAppStore((s) => s.addEntry)

  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayStr())
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!user) {
    return (
      <div className="page page--centered">
        <p className="empty-state">No profile found. Set one up in Profile first.</p>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const w = parseFloat(weight)
    if (isNaN(w) || w <= 0) {
      setError('Please enter a valid weight.')
      return
    }
    if (w > 1500 || w < 20) {
      setError(`That weight seems off. Enter in ${user!.unit}.`)
      return
    }
    if (!date) {
      setError('Please select a date.')
      return
    }

    addEntry(user!.id, w, date)
    setSaved(true)

    // Reset for next entry
    setTimeout(() => {
      setWeight('')
      setDate(todayStr())
      setSaved(false)
    }, 1200)
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Log Weight</h1>
        <span className="page-subtitle">{user.name}</span>
      </header>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="weight" className="form-label">
            Weight ({user.unit})
          </label>
          <input
            id="weight"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="1500"
            placeholder={`e.g. ${user.unit === 'lbs' ? '185.5' : '84.2'}`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="form-input form-input--lg"
            autoFocus
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="date" className="form-label">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="form-input"
            required
          />
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className={`btn btn--primary btn--full ${saved ? 'btn--saved' : ''}`}
        >
          {saved ? 'Saved ✓' : 'Save Entry'}
        </button>
      </form>

      <RecentEntries userId={user.id} unit={user.unit} />
    </div>
  )
}

// ─── Recent entries for this user ────────────────────────────────────────────

function RecentEntries({
  userId,
  unit,
}: {
  userId: string
  unit: import('@/types').WeightUnit
}) {
  const entries = useAppStore((s) =>
    s.entries
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10),
  )
  const removeEntry = useAppStore((s) => s.removeEntry)

  if (entries.length === 0) return null

  return (
    <section className="section">
      <h2 className="section-title">Recent Entries</h2>
      <ul className="entry-list">
        {entries.map((e) => (
          <li key={e.id} className="entry-row">
            <span className="entry-date">{formatDisplayDate(e.date)}</span>
            <span className="entry-weight">
              {e.weight.toFixed(1)} {unit}
            </span>
            <button
              className="entry-delete"
              onClick={() => removeEntry(e.id)}
              aria-label="Delete entry"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
