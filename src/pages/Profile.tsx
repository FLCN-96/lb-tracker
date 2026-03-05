import { useState, useMemo, useRef } from 'react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import { storage } from '@/services/storage'
import { fetchUsers, fetchEntries, pushUsers, pushEntries } from '@/services/github'
import type { Gender } from '@/types'

// ─── BMI helpers ──────────────────────────────────────────────────────────────

function calcBMI(weightLbs: number, heightIn: number): number {
  return (weightLbs / (heightIn * heightIn)) * 703
}

function bmiCategory(bmi: number): { label: string; cls: string } {
  if (bmi < 18.5) return { label: 'Underweight', cls: 'bmi-tag--under' }
  if (bmi < 25)   return { label: 'Normal',      cls: 'bmi-tag--normal' }
  if (bmi < 30)   return { label: 'Overweight',  cls: 'bmi-tag--over' }
  return                  { label: 'Obese',       cls: 'bmi-tag--obese' }
}

function weightAtBMI(targetBMI: number, heightIn: number): number {
  return (targetBMI * heightIn * heightIn) / 703
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v)
}

function randomHex(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
}

// ─── Floppy-disk save icon (inline SVG) ───────────────────────────────────────
function FloppyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17,21 17,13 7,13 7,21"/>
      <polyline points="7,3 7,8 15,8"/>
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile() {
  const user = useAppStore(selectActiveUser)
  const entries = useAppStore((s) => s.entries)
  const updateUser = useAppStore((s) => s.updateUser)
  const ghConfig = storage.loadGitHubConfig()
  const colorInputRef = useRef<HTMLInputElement>(null)

  // ── Single unified form state ──────────────────────────────────────────────
  const [name, setName] = useState(user?.name ?? '')
  const [heightFt, setHeightFt] = useState<string | number>(
    user?.heightIn ? Math.floor(user.heightIn / 12) : '',
  )
  const [heightInVal, setHeightInVal] = useState<string | number>(
    user?.heightIn ? user.heightIn % 12 : '',
  )
  const [gender, setGender] = useState<Gender | ''>(user?.gender ?? '')
  const [goalWeight, setGoalWeight] = useState(user?.goalWeight?.toFixed(1) ?? '')
  const [favoriteColor, setFavoriteColor] = useState(user?.favoriteColor ?? '')

  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncFlash, setSyncFlash] = useState<'ok' | 'err' | null>(null)

  if (!user) {
    return (
      <div className="page page--centered">
        <p className="empty-state">No profile selected.</p>
      </div>
    )
  }

  // Most recent weight for this user
  const recentWeight = useMemo(() => {
    const sorted = entries
      .filter((e) => e.userId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0]?.weight ?? null
  }, [entries, user.id])

  // ── Dirty check ───────────────────────────────────────────────────────────
  const storedHeightFt = user.heightIn ? Math.floor(user.heightIn / 12) : ''
  const storedHeightIn = user.heightIn ? user.heightIn % 12 : ''
  const isDirty =
    name !== user.name ||
    String(heightFt) !== String(storedHeightFt) ||
    String(heightInVal) !== String(storedHeightIn) ||
    gender !== (user.gender ?? '') ||
    goalWeight !== (user.goalWeight?.toFixed(1) ?? '') ||
    favoriteColor !== (user.favoriteColor ?? '')

  // ── Computed BMI ──────────────────────────────────────────────────────────
  const totalHeightIn =
    heightFt !== '' && heightInVal !== ''
      ? Number(heightFt) * 12 + Number(heightInVal)
      : user.heightIn
  const bmi = totalHeightIn && recentWeight ? calcBMI(recentWeight, totalHeightIn) : null
  const thresholds = totalHeightIn
    ? {
        under:     weightAtBMI(18.5, totalHeightIn),
        normalTop: weightAtBMI(25,   totalHeightIn),
        overTop:   weightAtBMI(30,   totalHeightIn),
      }
    : null

  // ── Save handler ──────────────────────────────────────────────────────────
  function handleSave() {
    const totalIn =
      heightFt !== '' && heightInVal !== ''
        ? Number(heightFt) * 12 + Number(heightInVal)
        : null
    updateUser(user!.id, {
      name: name.trim() || user!.name,
      heightIn: totalIn,
      gender: gender || null,
      goalWeight: parseFloat(goalWeight) || null,
      startingWeight: user!.startingWeight ?? recentWeight ?? null,
      favoriteColor: isValidHex(favoriteColor) ? favoriteColor : null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  // ── Sync handler ──────────────────────────────────────────────────────────
  async function handleSync() {
    if (!ghConfig?.token) return
    setSyncing(true)
    setSyncFlash(null)
    try {
      const cfg = { token: ghConfig.token, repo: ghConfig.repo }
      const { users: remoteUsers, sha: usersSha } = await fetchUsers(cfg)
      const { users: localUsers, entries: localEntries } = useAppStore.getState()
      const allIds = new Set([...localUsers.map((u) => u.id), ...remoteUsers.map((u) => u.id)])
      const remoteEntries: import('@/types').WeightEntry[] = []
      const entryShas: Record<string, string | null> = {}
      for (const uid of allIds) {
        const { entries: ue, sha } = await fetchEntries(cfg, uid)
        remoteEntries.push(...ue)
        entryShas[uid] = sha
      }
      await pushUsers(cfg, localUsers, usersSha)
      for (const u of localUsers) {
        const ue = localEntries.filter((e) => e.userId === u.id)
        await pushEntries(cfg, u.id, ue, entryShas[u.id] ?? null, u.name)
      }
      storage.saveGitHubConfig({ ...ghConfig, lastSynced: new Date().toISOString() })
      setSyncFlash('ok')
      setTimeout(() => setSyncFlash(null), 2000)
    } catch {
      setSyncFlash('err')
      setTimeout(() => setSyncFlash(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  const displayColor = isValidHex(favoriteColor) ? favoriteColor : undefined

  return (
    <div className="page">
      {/* ── Header with action buttons ── */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <span className="page-subtitle">{user.emoji} {user.name}</span>
        </div>
        <div className="header-actions">
          <button
            className={`btn-icon${isDirty ? ' btn-icon--pulse' : ''}${saved ? ' btn-icon--saved' : ''}`}
            onClick={handleSave}
            disabled={!isDirty && !saved}
            aria-label="Save profile"
            title="Save changes"
          >
            {saved ? '✓' : <FloppyIcon />}
          </button>
          {ghConfig?.token && (
            <button
              className={`btn-sync${syncing ? ' btn-sync--spin' : ''}${
                syncFlash === 'ok' ? ' btn-sync--ok' : syncFlash === 'err' ? ' btn-sync--err' : ''
              }`}
              onClick={handleSync}
              disabled={syncing}
              aria-label="Sync to GitHub"
            >
              ↻
            </button>
          )}
        </div>
      </header>

      {/* ── Identity ── */}
      <section className="section">
        <div className="section-title">Identity</div>
        <div className="form">
          <div className="form-group">
            <label htmlFor="edit-name" className="form-label">Display name</label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              maxLength={40}
            />
          </div>

          {/* Favorite color */}
          <div className="form-group">
            <label className="form-label">Favorite color</label>
            <div className="color-row">
              <input
                type="text"
                value={favoriteColor}
                onChange={(e) => setFavoriteColor(e.target.value)}
                className="form-input"
                placeholder="#3a7d44"
                maxLength={7}
                style={displayColor ? { color: displayColor, fontWeight: 700 } : undefined}
              />
              {/* Hidden native color picker */}
              <input
                ref={colorInputRef}
                type="color"
                value={isValidHex(favoriteColor) ? favoriteColor : '#3a7d44'}
                onChange={(e) => setFavoriteColor(e.target.value)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
                aria-hidden="true"
              />
              <button
                type="button"
                className="color-swatch-btn"
                style={displayColor ? { background: displayColor } : undefined}
                onClick={() => colorInputRef.current?.click()}
                aria-label="Pick color"
                title="Open color picker"
              >
                {!displayColor && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="13.5" cy="6.5" r="2.5"/>
                    <path d="M17 16a5 5 0 1 1-10 0c0-2.5 2-5 5-7.5C15 11 17 13.5 17 16z"/>
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="color-random-btn"
                onClick={() => setFavoriteColor(randomHex())}
                aria-label="Random color"
                title="Random color"
              >
                🎲
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body stats ── */}
      <section className="section">
        <div className="section-title">Body Stats</div>
        <div className="form">
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

          {recentWeight !== null && (
            <div className="form-group">
              <label className="form-label">Most recent weight</label>
              <div className="readonly-value">{recentWeight.toFixed(1)} {user.unit}</div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="goal-weight" className="form-label">Goal weight ({user.unit})</label>
            <input
              id="goal-weight"
              type="number" inputMode="decimal" step="0.1" min="50" max="1000"
              placeholder="—"
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value)}
              className="form-input"
            />
          </div>
        </div>
      </section>

      {/* ── BMI analysis ── */}
      {bmi !== null && thresholds !== null && recentWeight !== null && (
        <section className="section">
          <div className="section-title">BMI Analysis</div>
          <div className="bmi-card">
            <div className="bmi-score-row">
              <span className="bmi-score">{bmi.toFixed(1)}</span>
              <span className={`bmi-tag ${bmiCategory(bmi).cls}`}>{bmiCategory(bmi).label}</span>
            </div>
            <div className="bmi-thresholds">
              {[
                { label: 'Underweight (<18.5)', at: thresholds.under, rangeEnd: null },
                { label: 'Normal (18.5–24.9)', at: thresholds.under, rangeEnd: thresholds.normalTop },
                { label: 'Overweight (25–29.9)', at: thresholds.normalTop, rangeEnd: thresholds.overTop },
                { label: 'Obese (≥30)', at: thresholds.overTop, rangeEnd: null },
              ].map(({ label, at, rangeEnd }, i) => {
                const inRange = i === 0
                  ? bmi < 18.5
                  : i === 1
                  ? bmi >= 18.5 && bmi < 25
                  : i === 2
                  ? bmi >= 25 && bmi < 30
                  : bmi >= 30
                const diff = recentWeight - at
                const deltaLabel = inRange
                  ? 'You are here ✓'
                  : diff > 0
                  ? `−${diff.toFixed(1)} lbs to reach`
                  : `+${Math.abs(diff).toFixed(1)} lbs above`
                return (
                  <div key={i} className={`bmi-row${inRange ? ' bmi-row--active' : ''}`}>
                    <span className="bmi-row__label">{label}</span>
                    <span className="bmi-row__value">
                      {rangeEnd
                        ? `${at.toFixed(1)}–${rangeEnd.toFixed(1)} lbs`
                        : i === 0 ? `< ${at.toFixed(1)} lbs` : `> ${at.toFixed(1)} lbs`}
                    </span>
                    <span className={`bmi-row__delta ${inRange ? 'delta--down' : ''}`}>
                      {deltaLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {(!totalHeightIn || recentWeight === null) && (
        <p className="empty-state" style={{ padding: '4px var(--space-md) 16px', fontSize: 13 }}>
          {!totalHeightIn
            ? 'Enter height above to see BMI analysis.'
            : 'Log a weight entry to see BMI analysis.'}
        </p>
      )}
    </div>
  )
}
