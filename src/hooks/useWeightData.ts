import { useMemo } from 'react'
import { useAppStore, selectActiveUser } from '@/store/useAppStore'
import {
  computeWeeklyAverages,
  getRecentWeeks,
  totalWeightLost,
  computeStreak,
} from '@/utils/weightCalc'
import type { WeeklyAverage } from '@/types'

/** Returns all computed data for the currently active user. */
export function useActiveUserData() {
  const user = useAppStore(selectActiveUser)
  const entries = useAppStore((s) => s.entries)

  return useMemo(() => {
    if (!user) return null

    const wsd = user.weekStartDay ?? 1
    const weeklyAverages = computeWeeklyAverages(user.id, entries, wsd)
    const { current, previous } = getRecentWeeks(user.id, entries, wsd)
    const lost = totalWeightLost(user.id, entries, wsd)
    const streak = computeStreak(user.id, entries, wsd)

    return {
      user,
      weeklyAverages,
      currentWeek: current,
      previousWeek: previous,
      totalLost: lost,
      streak,
    }
  }, [user, entries])
}

/** Returns weekly averages for a specific user by id. */
export function useUserWeeklyAverages(userId: string): WeeklyAverage[] {
  const user = useAppStore((s) => s.users.find((u) => u.id === userId))
  const entries = useAppStore((s) => s.entries)
  return useMemo(
    () => computeWeeklyAverages(userId, entries, user?.weekStartDay ?? 1),
    [userId, entries, user?.weekStartDay],
  )
}

/** Returns all users with their most recent weekly average, for the group view. */
export function useGroupSnapshot() {
  const users = useAppStore((s) => s.users)
  const entries = useAppStore((s) => s.entries)

  return useMemo(() => {
    return users.map((user) => {
      const { current } = getRecentWeeks(user.id, entries, user.weekStartDay ?? 1)
      return { user, currentWeek: current }
    })
  }, [users, entries])
}
