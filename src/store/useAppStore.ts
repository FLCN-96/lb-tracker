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
}

type AppStore = AppState & AppActions

export const useAppStore = create<AppStore>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  activeUserId: null,
  users: [],
  entries: [],

  // ── Hydration ─────────────────────────────────────────────────────────────
  hydrate: () => {
    set({
      users: storage.loadUsers(),
      entries: storage.loadEntries(),
      activeUserId: storage.loadActiveUserId(),
    })
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
      createdAt: new Date().toISOString(),
    }
    const users = [...get().users, user]
    set({ users })
    storage.saveUsers(users)

    // Auto-select if first user
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
}))

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectActiveUser = (s: AppStore) =>
  s.users.find((u) => u.id === s.activeUserId) ?? null

export const selectAllUsers = (s: AppStore) => s.users
