import { create } from 'zustand'
import { storage } from '@/services/storage'
import type { User, WeightEntry, AppState, UserEmoji } from '@/types'
import { generateId } from '@/utils/id'

interface AppActions {
  // User actions
  addUser: (name: string, emoji: UserEmoji, unit: User['unit'], startingWeight?: number, goalWeight?: number) => User
  updateUser: (id: string, patch: Partial<Omit<User, 'id' | 'createdAt'>>) => void
  updateEntry: (id: string, weight: number, note?: string) => void
  removeUser: (id: string) => void
  setActiveUser: (id: string | null) => void

  // Entry actions
  addEntry: (userId: string, weight: number, date: string, note?: string) => WeightEntry
  removeEntry: (id: string) => void

  // Hydrate from storage (called once on mount)
  hydrate: () => void

  // Merge remote data into local state (used by GitHub sync)
  mergeData: (remoteUsers: User[], remoteEntries: WeightEntry[]) => void

  // Replace local state entirely with remote data (destructive sync)
  replaceData: (remoteUsers: User[], remoteEntries: WeightEntry[]) => void

  // Remove duplicate users (same name) and remap their entries
  deduplicate: () => void
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  activeUserId: null,
  users: [],
  entries: [],

  // ── Hydration ─────────────────────────────────────────────────────────────
  hydrate: () => {
    const users = storage.loadUsers()
    const entries = storage.loadEntries()
    const activeUserId = storage.loadActiveUserId()
    // Patch any legacy users missing the new fields
    const patched = users.map((u) => ({
      heightIn: null,
      gender: null,
      favoriteColor: null,
      weekStartDay: 1 as const,
      ...u,
    }))
    set({ users: patched, entries, activeUserId })
  },

  // ── User actions ──────────────────────────────────────────────────────────
  addUser: (name, emoji, unit, startingWeight, goalWeight) => {
    const user: User = {
      id: generateId(),
      name: name.trim(),
      emoji,
      unit,
      startingWeight: startingWeight ?? null,
      goalWeight: goalWeight ?? null,
      heightIn: null,
      gender: null,
      favoriteColor: null,
      weekStartDay: 1,
      createdAt: new Date().toISOString(),
    }
    const users = [...get().users, user]
    set({ users })
    storage.saveUsers(users)

    if (get().activeUserId === null) {
      set({ activeUserId: user.id })
      storage.saveActiveUserId(user.id)
    }

    return user
  },

  updateUser: (id, patch) => {
    const users = get().users.map((u) => (u.id === id ? { ...u, ...patch } : u))
    set({ users })
    storage.saveUsers(users)
  },

  removeUser: (id) => {
    const users = get().users.filter((u) => u.id !== id)
    const entries = get().entries.filter((e) => e.userId !== id)
    let { activeUserId } = get()
    if (activeUserId === id) {
      activeUserId = users[0]?.id ?? null
    }
    set({ users, entries, activeUserId })
    storage.saveUsers(users)
    storage.saveEntries(entries)
    storage.saveActiveUserId(activeUserId)
  },

  setActiveUser: (id) => {
    set({ activeUserId: id })
    storage.saveActiveUserId(id)
  },

  // ── Entry actions ─────────────────────────────────────────────────────────
  addEntry: (userId, weight, date, note) => {
    const entry: WeightEntry = {
      id: generateId(),
      userId,
      weight,
      date,
      note: note?.trim() ?? null,
      createdAt: new Date().toISOString(),
    }
    const entries = [...get().entries, entry]
    set({ entries })
    storage.saveEntries(entries)
    return entry
  },

  updateEntry: (id, weight, note) => {
    const entries = get().entries.map((e) =>
      e.id === id ? { ...e, weight, note: note?.trim() ?? e.note } : e,
    )
    set({ entries })
    storage.saveEntries(entries)
  },

  removeEntry: (id) => {
    const entries = get().entries.filter((e) => e.id !== id)
    set({ entries })
    storage.saveEntries(entries)
  },

  // ── Sync: merge (non-destructive) ─────────────────────────────────────────
  mergeData: (remoteUsers, remoteEntries) => {
    const { users: localUsers, entries: localEntries } = get()

    // Users: local wins for same ID (preserves local edits like favoriteColor).
    // Remote-only users (different IDs, e.g. new family members) are added.
    const userMap = new Map<string, User>()
    for (const u of remoteUsers) userMap.set(u.id, u)
    for (const u of localUsers) userMap.set(u.id, u)  // local overwrites remote for same ID

    // Patch any legacy fields missing from remote-only users
    const users = [...userMap.values()].map((u) => ({
      heightIn: null,
      gender: null,
      favoriteColor: null,
      weekStartDay: 1 as const,
      ...u,
    }))

    // Entries: remote wins for same ID (picks up edits from other devices),
    // local-only entries (not yet pushed) are kept.
    const entryMap = new Map<string, WeightEntry>()
    for (const e of remoteEntries) entryMap.set(e.id, e)
    for (const e of localEntries) if (!entryMap.has(e.id)) entryMap.set(e.id, e)
    const entries = [...entryMap.values()]

    set({ users, entries })
    storage.saveUsers(users)
    storage.saveEntries(entries)
  },

  // ── Sync: replace (destructive) ───────────────────────────────────────────
  replaceData: (remoteUsers, remoteEntries) => {
    const { activeUserId, users: localUsers } = get()
    const currentUser = localUsers.find((u) => u.id === activeUserId)

    // Try to keep the same "person" selected by matching on name
    let newActiveId: string | null = null
    if (currentUser) {
      const match = remoteUsers.find(
        (u) => u.name.toLowerCase() === currentUser.name.toLowerCase(),
      )
      newActiveId = match?.id ?? remoteUsers[0]?.id ?? null
    } else {
      newActiveId = remoteUsers[0]?.id ?? null
    }

    // Patch any missing new fields on remote users
    const patched = remoteUsers.map((u) => ({ heightIn: null, gender: null, favoriteColor: null, weekStartDay: 1 as const, ...u }))

    set({ users: patched, entries: remoteEntries, activeUserId: newActiveId })
    storage.saveUsers(patched)
    storage.saveEntries(remoteEntries)
    storage.saveActiveUserId(newActiveId)
  },

  // ── Deduplicate: merge users with same name ───────────────────────────────
  deduplicate: () => {
    const { users, entries, activeUserId } = get()

    // Group by normalised name
    const byName = new Map<string, User[]>()
    for (const u of users) {
      const key = u.name.toLowerCase().trim()
      byName.set(key, [...(byName.get(key) ?? []), u])
    }

    const keptUsers: User[] = []
    const idRemap = new Map<string, string>() // dup id → kept id

    for (const group of byName.values()) {
      if (group.length === 1) {
        keptUsers.push(group[0])
        continue
      }
      // Keep the user with the most entries; tie-break by earliest createdAt
      const sorted = [...group].sort((a, b) => {
        const aC = entries.filter((e) => e.userId === a.id).length
        const bC = entries.filter((e) => e.userId === b.id).length
        return bC !== aC ? bC - aC : a.createdAt.localeCompare(b.createdAt)
      })
      keptUsers.push(sorted[0])
      for (const dup of sorted.slice(1)) idRemap.set(dup.id, sorted[0].id)
    }

    // Re-map entries from removed duplicates
    const remapped = entries.map((e) =>
      idRemap.has(e.userId) ? { ...e, userId: idRemap.get(e.userId)! } : e,
    )

    // Deduplicate entries with same userId+date (keep most-recent createdAt)
    const entryByKey = new Map<string, WeightEntry>()
    for (const e of remapped) {
      const key = `${e.userId}:${e.date}`
      const existing = entryByKey.get(key)
      if (!existing || e.createdAt > existing.createdAt) entryByKey.set(key, e)
    }
    const dedupedEntries = [...entryByKey.values()]

    const newActiveId =
      activeUserId && idRemap.has(activeUserId)
        ? idRemap.get(activeUserId)!
        : activeUserId

    set({ users: keptUsers, entries: dedupedEntries, activeUserId: newActiveId })
    storage.saveUsers(keptUsers)
    storage.saveEntries(dedupedEntries)
    storage.saveActiveUserId(newActiveId)
  },
}))

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectActiveUser = (s: AppStore) =>
  s.users.find((u) => u.id === s.activeUserId) ?? null

export const selectAllUsers = (s: AppStore) => s.users
