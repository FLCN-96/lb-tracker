import { NavLink, Outlet } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/',         label: 'Home',     icon: '⌂'  },
  { to: '/group',    label: 'Group',    icon: '◉'  },
  { to: '/profile',  label: 'Profile',  icon: '◎'  },
  { to: '/settings', label: 'Settings', icon: '⚙'  },
] as const

export default function Layout() {
  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>

      <nav className="tab-bar" role="navigation" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
            aria-label={label}
          >
            <span className="tab-icon" aria-hidden="true">{icon}</span>
            <span className="tab-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
