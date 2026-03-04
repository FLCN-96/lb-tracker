/**
 * GitHub Contents API adapter.
 *
 * Data layout in the repo:
 *   data/users.json              ← User[]
 *   data/entries-{userId}.json   ← WeightEntry[]  (one file per user)
 *
 * Each write becomes a real git commit — full history for free.
 */

import type { User, WeightEntry } from '@/types'

const API = 'https://api.github.com'

export interface GitHubConfig {
  /** Fine-grained PAT with Contents read+write on this repo only. */
  token: string
  /** "owner/repo" e.g. "FLCN-96/lb-tracker" */
  repo: string
}

interface GHFile {
  sha: string
  content: string // base64, may contain newlines
}

// ── Encoding helpers ──────────────────────────────────────────────────────────

function encode(data: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
}

function decode(b64: string): unknown {
  return JSON.parse(decodeURIComponent(escape(atob(b64.replace(/\s/g, '')))))
}

// ── Raw API ───────────────────────────────────────────────────────────────────

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

async function getFile(cfg: GitHubConfig, path: string): Promise<GHFile | null> {
  const res = await fetch(`${API}/repos/${cfg.repo}/contents/${path}`, {
    headers: ghHeaders(cfg.token),
  })
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `GitHub ${res.status} — ${path}`)
  }
  return res.json() as Promise<GHFile>
}

async function putFile(
  cfg: GitHubConfig,
  path: string,
  data: unknown,
  sha: string | null,
  message: string,
): Promise<void> {
  const res = await fetch(`${API}/repos/${cfg.repo}/contents/${path}`, {
    method: 'PUT',
    headers: ghHeaders(cfg.token),
    body: JSON.stringify({
      message,
      content: encode(data),
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `GitHub ${res.status} — ${path}`)
  }
}

// ── Public typed API ──────────────────────────────────────────────────────────

export async function fetchUsers(
  cfg: GitHubConfig,
): Promise<{ users: User[]; sha: string | null }> {
  const file = await getFile(cfg, 'data/users.json')
  if (!file) return { users: [], sha: null }
  return { users: decode(file.content) as User[], sha: file.sha }
}

export async function pushUsers(
  cfg: GitHubConfig,
  users: User[],
  sha: string | null,
): Promise<void> {
  await putFile(
    cfg,
    'data/users.json',
    users,
    sha,
    `sync: users [${new Date().toISOString()}]`,
  )
}

export async function fetchEntries(
  cfg: GitHubConfig,
  userId: string,
): Promise<{ entries: WeightEntry[]; sha: string | null }> {
  const file = await getFile(cfg, `data/entries-${userId}.json`)
  if (!file) return { entries: [], sha: null }
  return { entries: decode(file.content) as WeightEntry[], sha: file.sha }
}

export async function pushEntries(
  cfg: GitHubConfig,
  userId: string,
  entries: WeightEntry[],
  sha: string | null,
  userName: string,
): Promise<void> {
  await putFile(
    cfg,
    `data/entries-${userId}.json`,
    entries,
    sha,
    `sync: ${userName} [${new Date().toISOString()}]`,
  )
}
