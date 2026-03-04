import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { WeightUnit } from '@/types'

interface Props {
  userId: string
  unit: WeightUnit
  onClose: () => void
}

interface DayRow {
  date: string
  label: string
  existingEntryId: string | null
  existingWeight: number | null
}

export default function ExpandLog({ userId, unit, onClose }: Props) {
  const entries = useAppStore((s) => s.entries)
  const addEntry = useAppStore((s) => s.addEntry)
  const updateEntry = useAppStore((s) => s.updateEntry)
  const removeEntry = useAppStore((s) => s.removeEntry)

  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Build rows: today + last 7 days = 8 rows
  const days = buildDays(7)
  const userEntries = entries.filter((e) => e.userId === userId)

  const entryByDate = new Map(userEntries.map((e) => [e.date, e]))

  const rows: DayRow[] = days.map((d) => {
    const entry = entryByDate.get(d.date)
    return {
      date: d.date,
      label: d.label,
      existingEntryId: entry?.id ?? null,
      existingWeight: entry?.weight ?? null,
    }
  })

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const r of rows) {
      init[r.date] = r.existingWeight !== null ? String(r.existingWeight) : ''
    }
    return init
  })

  const [saved, setSaved] = useState(false)

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSave() {
    for (const row of rows) {
      const raw = values[row.date]
      const w = parseFloat(raw)

      if (row.existingEntryId) {
        if (!raw || isNaN(w)) {
          removeEntry(row.existingEntryId)
        } else {
          updateEntry(row.existingEntryId, w)
        }
      } else if (raw && !isNaN(w) && w > 0) {
        addEntry(userId, w, row.date)
      }
    }
    setSaved(true)
    setTimeout(onClose, 700)
  }

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="modal-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-label="Log past entries">
        <h2 className="sheet-title">Log / Edit Entries</h2>

        <div className="date-log-grid">
          {rows.map((row) => (
            <div key={row.date} className="date-log-cell">
              <span className="date-log-cell__label">{row.label}</span>
              <div className="date-log-cell__row">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="20"
                  max="1500"
                  placeholder="—"
                  value={values[row.date]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [row.date]: e.target.value }))
                  }
                  className={`date-log-input ${values[row.date] ? 'date-log-input--filled' : ''}`}
                />
                <span className="date-log-unit">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--full" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn btn--primary btn--full ${saved ? 'btn--saved' : ''}`}
            onClick={handleSave}
          >
            {saved ? 'Saved ✓' : 'Save All'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDays(pastDays: number) {
  const today = new Date()
  const result = []

  for (let i = 0; i <= pastDays; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = toIsoDate(d)

    let label: string
    if (i === 0) {
      label = 'Today'
    } else if (i === 1) {
      label = 'Yest.'
    } else {
      const day = d.toLocaleDateString(undefined, { weekday: 'short' })
      const date = `${d.getMonth() + 1}/${d.getDate()}`
      label = `${day} ${date}`
    }

    result.push({ date: iso, label })
  }

  return result
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
