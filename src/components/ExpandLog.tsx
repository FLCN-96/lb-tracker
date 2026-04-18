import { useState } from 'react'
import { Drawer } from 'vaul'
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

  function handleSave() {
    for (const row of rows) {
      const raw = values[row.date]
      const w = parseFloat(raw)
      const valid = raw.trim() !== '' && !isNaN(w) && w >= 20 && w <= 1500

      if (row.existingEntryId) {
        if (!valid) {
          removeEntry(row.existingEntryId)
        } else {
          updateEntry(row.existingEntryId, w)
        }
      } else if (valid) {
        addEntry(userId, w, row.date)
      }
    }
    setSaved(true)
    setTimeout(onClose, 700)
  }

  return (
    <Drawer.Root open onClose={onClose} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-40"
          style={{ background: 'var(--color-overlay)' }}
        />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[var(--radius-lg)] focus:outline-none"
          style={{
            background: 'var(--color-surface)',
            paddingBottom: 'calc(var(--safe-bottom) + 16px)',
            maxHeight: '90dvh',
          }}
          data-testid="expand-log-dialog"
          aria-label="Log past entries"
        >
          {/* Drag handle */}
          <div className="mx-auto mt-3 mb-2 h-1.5 w-10 rounded-full" style={{ background: 'var(--color-border)' }} />

          <div className="overflow-y-auto px-4 pb-4">
            <Drawer.Title className="sheet-title">Log / Edit Entries</Drawer.Title>

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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
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
