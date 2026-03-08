/**
 * Thin localStorage wrapper with JSON serialization.
 * All data for the app lives under the 'lb-tracker' namespace.
 */

const KEYS = {
  USERS: 'lb-tracker:users',
  ENTRIES: 'lb-tracker:entries',
  ACTIVE_USER: 'lb-tracker:activeUserId',
  GITHUB: 'lb-tracker:github',
  DELETED_USERS: 'lb-tracker:deletedUsers',
} as const

export interface StoredGitHubConfig {
  token: string
  repo: string
  lastSynced: string | null // ISO timestamp
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error('[storage] Failed to persist:', key, err)
  }
}

export const storage = {
  loadUsers: () => load<import('@/types').User[]>(KEYS.USERS, []),
  saveUsers: (users: import('@/types').User[]) => save(KEYS.USERS, users),

  loadEntries: () => load<import('@/types').WeightEntry[]>(KEYS.ENTRIES, []),
  saveEntries: (entries: import('@/types').WeightEntry[]) => save(KEYS.ENTRIES, entries),

  loadActiveUserId: () => load<string | null>(KEYS.ACTIVE_USER, null),
  saveActiveUserId: (id: string | null) => save(KEYS.ACTIVE_USER, id),

  loadGitHubConfig: () => load<StoredGitHubConfig | null>(KEYS.GITHUB, null),
  saveGitHubConfig: (cfg: StoredGitHubConfig | null) => save(KEYS.GITHUB, cfg),

  /** IDs of users deleted on this device, kept until next successful push. */
  loadDeletedUserIds: () => load<string[]>(KEYS.DELETED_USERS, []),
  saveDeletedUserIds: (ids: string[]) => save(KEYS.DELETED_USERS, ids),

  /** Wipe all app data — used for testing / account reset. */
  clearAll: () => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
  },
}
