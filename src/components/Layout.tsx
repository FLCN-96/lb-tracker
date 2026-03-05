import { NavLink, Outlet } from 'react-router-dom'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
      <polyline points="9,21 9,13 15,13 15,21"/>
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4"/>
      <path d="M4 21v-1a8 8 0 0 1 16 0v1"/>
    </svg>
  )
}

function GroupIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="3"/>
      <path d="M2 21v-1a6 6 0 0 1 12 0v1"/>
      <circle cx="17" cy="7" r="3"/>
      <path d="M22 21v-1a6 6 0 0 0-5-5.9"/>
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export default function Layout() {
  const activeUser = useAppStore(selectActiveUser)
  const profileLabel = activeUser?.name ?? 'Profile'

  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>

      <nav className="tab-bar" role="navigation" aria-label="Main navigation">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Home"
        >
          <span className="tab-icon" aria-hidden="true"><HomeIcon /></span>
          <span className="tab-label">Home</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Profile"
        >
          <span className="tab-icon" aria-hidden="true"><PersonIcon /></span>
          <span className="tab-label">{profileLabel}</span>
        </NavLink>

        <NavLink
          to="/group"
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Group"
        >
          <span className="tab-icon" aria-hidden="true"><GroupIcon /></span>
          <span className="tab-label">Group</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Settings"
        >
          <span className="tab-icon" aria-hidden="true"><GearIcon /></span>
          <span className="tab-label">Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}
