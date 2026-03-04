import { useGroupSnapshot } from '@/hooks/useWeightData'
import { useAppStore } from '@/store/useAppStore'
import { formatWeight, formatDelta } from '@/utils/weightCalc'
import { Link } from 'react-router-dom'

export default function Group() {
  const members = useGroupSnapshot()
  const setActiveUser = useAppStore((s) => s.setActiveUser)
  const activeUserId = useAppStore((s) => s.activeUserId)

  if (members.length === 0) {
    return (
      <div className="page page--centered">
        <h1 className="page-title">Group</h1>
        <p className="empty-state">
          No members yet.{' '}
          <Link to="/profile" className="link">
            Add a profile
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Group</h1>
        <span className="page-subtitle">{members.length} member{members.length !== 1 ? 's' : ''}</span>
      </header>

      <ul className="member-list">
        {members.map(({ user, currentWeek }) => (
          <li
            key={user.id}
            className={`member-card ${user.id === activeUserId ? 'member-card--active' : ''}`}
            onClick={() => setActiveUser(user.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setActiveUser(user.id)}
            aria-pressed={user.id === activeUserId}
          >
            <div className="member-avatar" aria-hidden="true">
              {user.emoji}
            </div>
            <div className="member-info">
              <span className="member-name">{user.name}</span>
              <span className="member-unit">{user.unit}</span>
            </div>
            <div className="member-stats">
              {currentWeek ? (
                <>
                  <span className="member-avg">{formatWeight(currentWeek.average, user.unit)}</span>
                  <span
                    className={`member-delta ${
                      currentWeek.delta === null
                        ? ''
                        : currentWeek.delta < 0
                        ? 'delta--down'
                        : currentWeek.delta > 0
                        ? 'delta--up'
                        : ''
                    }`}
                  >
                    {formatDelta(currentWeek.delta, user.unit)}
                  </span>
                </>
              ) : (
                <span className="member-no-data">No data</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
