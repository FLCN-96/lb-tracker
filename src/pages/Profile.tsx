import { useState, useMemo } from 'react'
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
  if (bmi < 25)   return { label: 'Normal', cls: 'bmi-tag--normal' }
  if (bmi < 30)   return { label: 'Overweight', cls: 'bmi-tag--over' }
  return { label: 'Obese', cls: 'bmi-tag--obese' }
}

function weightAtBMI(targetBMI: number, heightIn: number): number {
  return (targetBMI * heightIn * heightIn) / 703
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Profile() {
  const user = useAppStore(selectActiveUser)
  const entries = useAppStore((s) => s.entries)
  const updateUser = useAppStore((s) => s.updateUser)
  const ghConfig = storage.loadGitHubConfig()

  // Profile fields
  const [name, setName] = useState(user?.name ?? '')
  const [nameSaved, setNameSaved] = useState(false)

  // Body stats
  const [heightFt, setHeightFt] = useState(() =>
    user?.heightIn ? Math.floor(user.heightIn / 12) : '',
  )
  const [heightIn, setHeightIn] = useState(() =>
    user?.heightIn ? user.heightIn % 12 : '',
  )
  const [gender, setGender] = useState<Gender | ''>(user?.gender ?? '')
  const [statsSaved, setStatsSaved] = useState(false)

  // Goal
  const [goalWeight, setGoalWeight] = useState(user?.goalWeight?.toFixed(1) ?? '')
  const [goalSaved, setGoalSaved] = useState(false)

  // Sync state
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
    const userEntries = entries
      .filter((e) => e.userId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    return userEntries[0]?.weight ?? null
  }, [entries, user.id])

  // Computed BMI
  const totalHeightIn =
    heightFt !== '' && heightIn !== ''
      ? Number(heightFt) * 12 + Number(heightIn)
      : user.heightIn
  const bmi =
    totalHeightIn && recentWeight ? calcBMI(recentWeight, totalHeightIn) : null

  // Weight thresholds
  const thresholds = totalHeightIn
    ? {
        under: weightAtBMI(18.5, totalHeightIn),
        normalTop: weightAtBMI(25, totalHeightIn),
        overTop: weightAtBMI(30, totalHeightIn),
      }
    : null

  function saveName(e: React.FormEvent) {
    e.preventDefault()
    updateUser(user!.id, { name: name.trim() || user!.name })
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 1500)
  }

  function saveStats(e: React.FormEvent) {
    e.preventDefault()
    const totalIn =
      heightFt !== '' && heightIn !== ''
        ? Number(heightFt) * 12 + Number(heightIn)
        : null
    updateUser(user!.id, {
      heightIn: totalIn,
      gender: gender || null,
    })
    setStatsSaved(true)
    setTimeout(() => setStatsSaved(false), 1500)
  }

  function saveGoal(e: React.FormEvent) {
    e.preventDefault()
    const g = parseFloat(goalWeight)
    updateUser(user!.id, {
      goalWeight: !isNaN(g) && g > 0 ? g : null,
      startingWeight: user!.startingWeight ?? recentWeight ?? null,
    })
    setGoalSaved(true)
    setTimeout(() => setGoalSaved(false), 1500)
  }

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
      // Push merged users + entries
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

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <span className="page-subtitle">{user.emoji} {user.name}</span>
        </div>
        {ghConfig?.token && (
          <button
            className={`btn-sync${syncing ? ' btn-sync--spin' : ''}${
              syncFlash === 'ok' ? ' btn-sync--ok' : syncFlash === 'err' ? ' btn-sync--err' : ''
            }`}
            onClick={handleSync}
            disabled={syncing}
            aria-label="Sync profile to GitHub"
          >
            ↻
          </button>
        )}
      </header>

      {/* ── Display name ── */}
      <section className="section">
        <div className="section-title">Your Profile</div>
        <form className="form" onSubmit={saveName}>
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
          <button type="submit" className={`btn btn--primary btn--full ${nameSaved ? 'btn--saved' : ''}`}>
            {nameSaved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* ── Body stats ── */}
      <section className="section">
        <div className="section-title">Body Stats</div>
        <form className="form" onSubmit={saveStats}>
          <div className="form-group">
            <label className="form-label">Height</label>
            <div className="height-row">
              <input
                type="number"
                inputMode="numeric"
                min="3" max="8"
                placeholder="5"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
                className="form-input form-input--sm"
              />
              <span className="height-unit">ft</span>
              <input
                type="number"
                inputMode="numeric"
                min="0" max="11"
                placeholder="10"
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
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
                  key={g}
                  type="button"
                  className={`gender-btn ${gender === g ? 'gender-btn--active' : ''}`}
                  onClick={() => setGender((prev) => (prev === g ? '' : g))}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {recentWeight && (
            <div className="form-group">
              <label className="form-label">Most recent weight</label>
              <div className="readonly-value">{recentWeight.toFixed(1)} {user.unit}</div>
            </div>
          )}

          <button type="submit" className={`btn btn--primary btn--full ${statsSaved ? 'btn--saved' : ''}`}>
            {statsSaved ? 'Saved ✓' : 'Save Body Stats'}
          </button>
        </form>
      </section>

      {/* ── BMI ── */}
      {bmi !== null && thresholds && recentWeight && (
        <section className="section">
          <div className="section-title">BMI Analysis</div>
          <div className="bmi-card">
            <div className="bmi-score-row">
              <span className="bmi-score">{bmi.toFixed(1)}</span>
              <span className={`bmi-tag ${bmiCategory(bmi).cls}`}>
                {bmiCategory(bmi).label}
              </span>
            </div>

            <div className="bmi-thresholds">
              {/* Underweight threshold */}
              <div className="bmi-row">
                <span className="bmi-row__label">Underweight (&lt;18.5)</span>
                <span className="bmi-row__value">{thresholds.under.toFixed(1)} lbs</span>
                <span className={`bmi-row__delta ${recentWeight > thresholds.under ? 'delta--down' : 'delta--up'}`}>
                  {recentWeight > thresholds.under
                    ? `−${(recentWeight - thresholds.under).toFixed(1)} lbs to reach`
                    : `+${(thresholds.under - recentWeight).toFixed(1)} lbs above`}
                </span>
              </div>

              {/* Normal range */}
              <div className="bmi-row">
                <span className="bmi-row__label">Normal (18.5–24.9)</span>
                <span className="bmi-row__value">{thresholds.under.toFixed(1)}–{thresholds.normalTop.toFixed(1)} lbs</span>
                <span className={`bmi-row__delta ${bmi >= 18.5 && bmi < 25 ? 'delta--down' : ''}`}>
                  {bmi < 18.5
                    ? `+${(thresholds.under - recentWeight).toFixed(1)} lbs to gain`
                    : bmi >= 25
                    ? `−${(recentWeight - thresholds.normalTop).toFixed(1)} lbs to lose`
                    : 'You are here'}
                </span>
              </div>

              {/* Overweight threshold */}
              <div className="bmi-row">
                <span className="bmi-row__label">Overweight (25–29.9)</span>
                <span className="bmi-row__value">{thresholds.normalTop.toFixed(1)}–{thresholds.overTop.toFixed(1)} lbs</span>
                <span className={`bmi-row__delta ${bmi >= 25 && bmi < 30 ? '' : ''}`}>
                  {bmi < 25
                    ? `+${(thresholds.normalTop - recentWeight).toFixed(1)} lbs away`
                    : bmi >= 30
                    ? `−${(recentWeight - thresholds.overTop).toFixed(1)} lbs to lose`
                    : 'You are here'}
                </span>
              </div>

              {/* Obese threshold */}
              <div className="bmi-row">
                <span className="bmi-row__label">Obese (≥30)</span>
                <span className="bmi-row__value">{thresholds.overTop.toFixed(1)}+ lbs</span>
                <span className={`bmi-row__delta ${bmi >= 30 ? 'delta--up' : ''}`}>
                  {bmi >= 30
                    ? 'You are here'
                    : `+${(thresholds.overTop - recentWeight).toFixed(1)} lbs away`}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {(!totalHeightIn || !recentWeight) && (
        <section className="section">
          <p className="empty-state" style={{ fontSize: 13 }}>
            {!totalHeightIn ? 'Enter your height above to see BMI analysis.' : 'Log a weight entry to see BMI analysis.'}
          </p>
        </section>
      )}

      {/* ── Goal weight ── */}
      <section className="section">
        <div className="section-title">Goal Weight</div>
        <form className="form" onSubmit={saveGoal}>
          <div className="form-group">
            <label htmlFor="goal-weight" className="form-label">Target weight ({user.unit})</label>
            <input
              id="goal-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="50"
              max="1000"
              placeholder="—"
              value={goalWeight}
              onChange={(e) => setGoalWeight(e.target.value)}
              className="form-input"
            />
          </div>
          <button type="submit" className={`btn btn--primary btn--full ${goalSaved ? 'btn--saved' : ''}`}>
            {goalSaved ? 'Saved ✓' : 'Save Goal'}
          </button>
        </form>
      </section>
    </div>
  )
}
