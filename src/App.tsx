import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import Layout from '@/components/Layout'
import EmojiLogin from '@/components/EmojiLogin'
import Dashboard from '@/pages/Dashboard'
import Group from '@/pages/Group'
import Profile from '@/pages/Profile'
import Settings from '@/pages/Settings'

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate)
  const activeUserId = useAppStore((s) => s.activeUserId)
  const users = useAppStore((s) => s.users)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    hydrate()
    setHydrated(true)
  }, [hydrate])

  // Show a blank screen until storage is loaded to avoid flash
  if (!hydrated) return null

  // Show login/profile-picker when no active user is selected
  const needsLogin = !activeUserId || !users.find((u) => u.id === activeUserId)

  if (needsLogin) {
    return <EmojiLogin onDone={() => { /* store update triggers re-render */ }} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="group" element={<Group />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
