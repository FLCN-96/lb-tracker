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
  dayName: string
  existingEntryId: string | null
  existingWeight: number | null
}

export default function ExpandLog({ userId, unit, onClose }: Props) {
  const entries = useAppStore((s) => s.entries)
  const addEntry = useAppStore((s) => s.addEntry)
  const updateEntry = useAppStore((s) => s.updateEntry)
  const removeEntry = useAppStore((s) => s.removeEntry)

  const overlayRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Build rows: today + last 7 days
  const days = buildDays(7)
  const userEntries = entries.filter((e) => e.userId === userId)

  // Map date → entry
  const entryByDate = new Map(userEntries.map((e) => [e.date, e]))

  const rows: DayRow[] = days.map((d) => {
    const entry = entryByDate.get(d.date)
    return {
      date: d.date,
      label: d.label,
      dayName: d.dayName,
      existingEntryId: entry?.id ?? null,
      existingWeight: entry?.weight ?? null,
    }
  })

  // Local weight state per date
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const r of rows) {
      init[r.date] = r.existingWeight !== null ? String(r.existingWeight) : ''
    }
    return init
  })

  const [saved, setSaved] = useState(false)

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSave() {
    for (const row of rows) {
      const raw = values[row.date]
      const w = parseFloat(raw)

      if (row.existingEntryId) {
        if (!raw || isNaN(w)) {
          // Remove entry if cleared
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

  // Lock body scroll while open; prevent touch scroll from bleeding through overlay
  useEffect(() => {
    document.body.style.overflow = 'hidden'

    const overlay = overlayRef.current
    if (!overlay) return

    const handleTouchMove = (e: TouchEvent) => {
      if (!sheetRef.current?.contains(e.target as Node)) {
        e.preventDefault()
      }
    }
    overlay.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.body.style.overflow = ''
      overlay.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  return (
    <div className="sheet-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label="Log past entries">
        <div className="sheet-handle" />
        <h2 className="sheet-title">Log / Edit Entries</h2>

        <ul className="date-log-list">
          {rows.map((row) => (
            <li key={row.date} className="date-log-row">
              <div className="date-log-row__label">
                <div>{row.label}</div>
                <div className="date-log-row__sub">{row.dayName}</div>
              </div>
              <div className="date-log-row__right">
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
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
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

    const label =
      i === 0 ? 'Today' : i === 1 ? 'Yesterday' : formatShortDate(d)

    const dayName = i < 2 ? formatFullDate(d) : d.toLocaleDateString(undefined, { weekday: 'long' })

    result.push({ date: iso, label, dayName })
  }

  return result
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatFullDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

