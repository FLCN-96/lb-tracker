import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, User, Swords, Users, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'

const NAV_TABS = [
  { to: '/', end: true,  label: 'Home',     Icon: Home,     testId: 'tab-home'     },
  { to: '/profile',      label: 'Profile',  Icon: User,     testId: 'tab-profile'  },
  { to: '/battle',       label: 'Battle',   Icon: Swords,   testId: 'tab-battle'   },
  { to: '/group',        label: 'Group',    Icon: Users,    testId: 'tab-group'    },
  { to: '/settings',     label: 'Settings', Icon: Settings, testId: 'tab-settings' },
] as const

export default function Layout() {
  const activeUser = useAppStore(selectActiveUser)
  const location   = useLocation()

  return (
    <div className="app-shell">
      <main className="app-content">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{ height: '100%' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="tab-bar" role="navigation" aria-label="Main navigation" data-testid="tab-nav">
        {NAV_TABS.map(({ to, end, label, Icon, testId }) => {
          const displayLabel = label === 'Profile' ? (activeUser?.name ?? 'Profile') : label
          return (
            <NavLink
              key={to}
              to={to}
              end={end ?? false}
              className={({ isActive }) => `tab-item${isActive ? ' tab-item--active' : ''}`}
              aria-label={displayLabel}
              data-testid={testId}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      className="tab-active-pill"
                      layoutId="tab-active-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="tab-icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <span className="tab-label">{displayLabel}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
