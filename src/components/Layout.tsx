import { NavLink, Outlet } from 'react-router-dom'
import { Home, User, Swords, Users, Settings } from 'lucide-react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'

export default function Layout() {
  const activeUser = useAppStore(selectActiveUser)
  const profileLabel = activeUser?.name ?? 'Profile'

  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>

      <nav className="tab-bar" role="navigation" aria-label="Main navigation" data-testid="tab-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Home"
          data-testid="tab-home"
        >
          <span className="tab-icon" aria-hidden="true"><Home size={22} strokeWidth={2} /></span>
          <span className="tab-label">Home</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Profile"
          data-testid="tab-profile"
        >
          <span className="tab-icon" aria-hidden="true"><User size={22} strokeWidth={2} /></span>
          <span className="tab-label">{profileLabel}</span>
        </NavLink>

        <NavLink
          to="/battle"
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Battle"
          data-testid="tab-battle"
        >
          <span className="tab-icon" aria-hidden="true"><Swords size={22} strokeWidth={2} /></span>
          <span className="tab-label">Battle</span>
        </NavLink>

        <NavLink
          to="/group"
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Group"
          data-testid="tab-group"
        >
          <span className="tab-icon" aria-hidden="true"><Users size={22} strokeWidth={2} /></span>
          <span className="tab-label">Group</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
          aria-label="Settings"
          data-testid="tab-settings"
        >
          <span className="tab-icon" aria-hidden="true"><Settings size={22} strokeWidth={2} /></span>
          <span className="tab-label">Settings</span>
        </NavLink>
      </nav>
    </div>
  )
}
