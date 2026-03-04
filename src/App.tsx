import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import LogWeight from '@/pages/LogWeight'
import Group from '@/pages/Group'
import Profile from '@/pages/Profile'

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate)

  // Load persisted data once on mount
  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="log" element={<LogWeight />} />
          <Route path="group" element={<Group />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
