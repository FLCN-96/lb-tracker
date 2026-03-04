import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { AVAILABLE_EMOJIS } from '@/types'
import type { UserEmoji } from '@/types'

interface Props {
  onDone: () => void
}

type Step = 'pick-profile' | 'new-emoji' | 'new-name'

export default function EmojiLogin({ onDone }: Props) {
  const users = useAppStore((s) => s.users)
  const setActiveUser = useAppStore((s) => s.setActiveUser)
  const addUser = useAppStore((s) => s.addUser)

  const [step, setStep] = useState<Step>('pick-profile')
  const [selectedEmoji, setSelectedEmoji] = useState<UserEmoji | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Already-used emojis (so each user has a unique one)
  const usedEmojis = new Set(users.map((u) => u.emoji))
  const availableEmojis = AVAILABLE_EMOJIS.filter((e) => !usedEmojis.has(e))

  function handleSelectExisting(userId: string) {
    setActiveUser(userId)
    onDone()
  }

  function handleEmojiChosen(emoji: UserEmoji) {
    setSelectedEmoji(emoji)
    setStep('new-name')
  }

  function handleCreateProfile() {
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!selectedEmoji) { setError('Please pick an emoji.'); return }
    addUser(name.trim(), selectedEmoji, 'lbs')
    onDone()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === 'pick-profile') {
    return (
      <div className="login-screen">
        <div className="login-logo">⚖️</div>
        <div>
          <h1 className="login-title">LB Tracker</h1>
          <p className="login-subtitle" style={{ marginTop: 6, color: 'var(--color-text-muted)', fontSize: 15 }}>
            Who's tracking today?
          </p>
        </div>

        <div className="profile-grid">
          {users.map((u) => (
            <button
              key={u.id}
              className="profile-card"
              onClick={() => handleSelectExisting(u.id)}
            >
              <span className="profile-card__emoji">{u.emoji}</span>
              <span className="profile-card__name">{u.name}</span>
            </button>
          ))}

          {availableEmojis.length > 0 && (
            <button
              className="add-profile-btn"
              onClick={() => setStep('new-emoji')}
            >
              <span className="add-profile-btn__icon">＋</span>
              <span>Add</span>
            </button>
          )}
        </div>

        {users.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            No profiles yet. Add one to get started.
          </p>
        )}
      </div>
    )
  }

  if (step === 'new-emoji') {
    return (
      <div className="login-screen">
        <h1 className="login-title" style={{ fontSize: 22 }}>Pick your emoji</h1>

        <div className="emoji-grid" style={{ maxWidth: 260 }}>
          {availableEmojis.map((e) => (
            <button
              key={e}
              className={`emoji-opt ${selectedEmoji === e ? 'emoji-opt--selected' : ''}`}
              onClick={() => handleEmojiChosen(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <button className="btn btn--ghost" onClick={() => setStep('pick-profile')}>
          Back
        </button>
      </div>
    )
  }

  // step === 'new-name'
  return (
    <div className="login-screen">
      <span style={{ fontSize: 56 }}>{selectedEmoji}</span>
      <h1 className="login-title" style={{ fontSize: 22 }}>What's your name?</h1>

      <div className="form" style={{ width: '100%', maxWidth: 300 }}>
        <input
          type="text"
          className="form-input form-input--lg"
          placeholder="Your name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null) }}
          maxLength={24}
          autoFocus
        />

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn--primary btn--full" onClick={handleCreateProfile}>
          Let's go
        </button>

        <button
          className="btn btn--ghost btn--full"
          onClick={() => { setStep('new-emoji'); setSelectedEmoji(null) }}
        >
          Back
        </button>
      </div>
    </div>
  )
}
