# lb-tracker — Design Reference

A living reference capturing the architectural decisions, design system, and
patterns established in this project. Drop the path to this file in a new
project's CLAUDE.md to inherit these conventions.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 18 + TypeScript | Strict mode, no class components |
| Build | Vite 5 | `@` alias to `src/`, `tsc && vite build` |
| PWA | vite-plugin-pwa + Workbox | `autoUpdate`, `generateSW`, standalone manifest |
| Routing | react-router-dom v6 | `<Routes>` / `<Route>` / `<Outlet>`, no lazy loading |
| State | Zustand v5 | Single store, localStorage persistence, no devtools |
| Styles | Single `index.css` | CSS custom properties, no CSS-in-JS, no Tailwind |
| No testing framework | — | Ship fast, test manually |

---

## Project Structure

```
src/
  types/index.ts          # All domain types in one file
  services/
    storage.ts            # Thin localStorage wrapper (namespaced keys)
    github.ts             # GitHub Contents API calls (fetch/push)
  store/
    useAppStore.ts        # Zustand store — state + all mutations
  hooks/
    useWeightData.ts      # Derived/computed data hooks (no mutations)
  utils/
    weightCalc.ts         # Pure functions — weekly averages, stats, formatting
    id.ts                 # generateId() — crypto.randomUUID() with fallback
  components/
    Layout.tsx            # App shell + tab bar (NavLink)
    WeightChart.tsx       # SVG line chart (standalone, no chart lib)
    ExpandLog.tsx         # Modal for editing recent entries
    EmojiLogin.tsx        # Login/user-select screen
  pages/
    Dashboard.tsx         # Home: chart, quick log, stats
    Profile.tsx           # Personal stats, color, sync
    Group.tsx             # Multi-user management, sync
    Battle.tsx            # Head-to-head comparison charts
    Settings.tsx          # Body goals, import/export, GitHub config
  App.tsx                 # Router, hydration gate, login gate
  main.tsx                # Render, iOS standalone detection
  index.css               # Entire design system
```

---

## CSS Design System

### Philosophy
- One file (`index.css`). No component-scoped styles.
- All values via CSS custom properties. No magic numbers in JSX.
- Mobile-first, 480px max-width shell, no media-query breakpoints needed.
- Dark mode via `@media (prefers-color-scheme: dark)` token overrides only.

### Token Reference

```css
/* Palette (forest green) */
--color-primary       /* forest green — buttons, active states, accents */
--color-primary-mid   /* mid green */
--color-primary-light /* light green */
--color-down          /* green — good direction (weight lost) */
--color-up            /* red — bad direction (weight gained) */

/* Surfaces */
--color-bg            /* page background */
--color-bg-alt        /* inset/card background (e.g. info cards) */
--color-surface       /* raised surface (tab bar, modal) */
--color-surface-2     /* slightly elevated surface */
--color-border        /* standard border */
--color-border-light  /* subtle border */
--color-overlay       /* modal backdrop rgba */

/* Typography */
--color-text          /* primary text */
--color-text-2        /* secondary text */
--color-text-muted    /* hints, labels, timestamps */
--font-sans           /* system font stack */

/* Spacing (use these, not arbitrary px) */
--space-xs: 4px   --space-sm: 8px   --space-md: 16px
--space-lg: 24px  --space-xl: 36px

/* Radii */
--radius-sm: 8px   --radius-md: 14px
--radius-lg: 22px  --radius-xl: 32px

/* Shadows */
--shadow-sm  --shadow-md  --shadow-lg

/* PWA layout */
--tab-bar-h: 60px
--safe-bottom: env(safe-area-inset-bottom, 0px)
--safe-top:    env(safe-area-inset-top, 0px)
```

### App Shell Pattern (critical for PWA)

The shell is `position: fixed` with a flex column layout. This keeps the tab
bar pinned to the true bottom on iOS regardless of visual-viewport shifts.
Content scrolls inside `.app-content` (overflow-y: auto), never the body.

```css
.app-shell {
  position: fixed;
  top: 0;
  bottom: calc(-1 * env(safe-area-inset-bottom, 0px)); /* extend into safe area */
  left: max(0px, calc(50% - 240px));  /* caps width at 480px, centered */
  right: max(0px, calc(50% - 240px));
  display: flex;
  flex-direction: column;
}
.app-content { flex: 1; min-height: 0; overflow-y: auto; }
.tab-bar     { flex-shrink: 0; height: calc(var(--tab-bar-h) + var(--safe-bottom)); }
```

**Never use `position: sticky` or `height: 100vh`** — they break in iOS PWA
standalone mode. Use this fixed shell instead.

### Standard Component Classes

```
.page              padding: var(--space-md); used on every route root div
.page-header       flex row, space-between, used for title + action buttons
.page-title        h1 style
.page-subtitle     muted subtitle below h1
.section           card with border-radius, border, background, padding
.section-title     uppercase small label inside a section
.stat-card         metric card (label / value / sub-label stack)
.stat-grid         2-col grid of stat-cards
.form              flex-column form wrapper
.form-group        label + input stack
.form-label        small uppercase label
.form-input        standard text/number input
.form-hint         muted helper text below input
.form-error        red error message
.btn               base button
.btn--primary      filled primary color
.btn--secondary    outlined
.btn--ghost        transparent, subtle hover
.btn--danger       red destructive action
.btn--full         width: 100%
.btn--saved        green flash state (momentary confirmation)
.btn--pulse        animated ring (unsaved changes indicator)
.btn-sync          circular sync button with ↻ glyph
.btn-sync--spin    rotation animation while syncing
.btn-sync--ok      green flash after success
.btn-sync--err     red flash after failure
.btn-icon          small square icon button (floppy disk etc.)
.sync-hint         muted paragraph used as section preambles
.sync-ok           green success message
.sync-error        red error message
.empty-state       centered muted placeholder text
.modal-overlay     fixed full-screen backdrop
.modal-dialog      centered white card dialog
.sheet-title       dialog heading
```

### Interaction Conventions
- `-webkit-tap-highlight-color: transparent` on all interactive elements.
- `:active { opacity: 0.65 }` for press feedback — not `:hover` transforms.
- Button flash states (saved/error) auto-dismiss after 1.5–2.5s via `setTimeout`.
- Never use `window.confirm` or `window.alert` — implement inline confirmation
  states instead (see Group.tsx member card pattern).

---

## State Management

### Zustand Store Shape

```
AppState
  activeUserId: string | null
  users: User[]
  entries: WeightEntry[]

Actions (mutate state + persist to localStorage immediately):
  addUser / updateUser / removeUser / setActiveUser
  addEntry / updateEntry / removeEntry
  hydrate          — load from localStorage (called once on mount)
  mergeData        — bidirectional sync merge (remote + local → union)
  replaceData      — destructive overwrite from remote
  deduplicate      — collapse users with the same name
```

### localStorage Persistence Pattern

Every mutation writes to localStorage immediately after `set()`. No separate
sync layer. Use a thin typed wrapper (`storage.ts`) with namespaced keys:

```ts
const KEYS = {
  USERS:         'appname:users',
  ENTRIES:       'appname:entries',
  ACTIVE_USER:   'appname:activeUserId',
  GITHUB:        'appname:github',
  DELETED_USERS: 'appname:deletedUsers',   // tombstones
} as const
```

### Hydration Gate

```tsx
// App.tsx
const [hydrated, setHydrated] = useState(false)
useEffect(() => { hydrate(); setHydrated(true) }, [hydrate])
if (!hydrated) return null   // prevent flash of wrong state
```

### Derived Data — Hooks vs Store

**Keep the store thin.** Only raw data lives in the store. All derived/computed
values (weekly averages, streaks, trends) live in hooks under `hooks/`:

```ts
useActiveUserData()   // all computed stats for active user
useGroupSnapshot()    // lightweight per-user summary for list views
useUserWeeklyAverages(userId)
```

These use `useMemo` and subscribe only to the store slices they need.

---

## Sync Architecture (GitHub as Backend)

### How it works
- All data lives in a user-owned GitHub repo as JSON files.
- GitHub Contents API: fetch (GET) / push (PUT with SHA for updates).
- Every sync is bidirectional: fetch remote → merge → push merged.
- No server, no auth server. Only a fine-grained PAT stored in localStorage.

### Merge Strategy
- **Users**: Local wins for same ID (preserves local edits). Remote-only users
  are added (new family member on another device). Tombstoned IDs filtered out.
- **Entries**: Remote wins for same ID (picks up edits from other devices).
  Local-only entries (not yet pushed) are preserved.

### Tombstone Pattern (delete propagation without a server)

When a user is deleted locally, their ID is stored in a `deletedUsers`
localStorage key. On every sync, tombstoned IDs are filtered from the remote
response *before* merging — so the deleted user is never re-added. After a
successful push (deletion is now on GitHub), tombstones are cleared.

```ts
// On removeUser:
const deleted = [...new Set([...storage.loadDeletedUserIds(), id])]
storage.saveDeletedUserIds(deleted)

// In every sync function:
const tombstones = new Set(storage.loadDeletedUserIds())
const filteredRemote = remoteUsers.filter((u) => !tombstones.has(u.id))
// ... merge and push ...
storage.saveDeletedUserIds([])   // clear after successful push
```

**This pattern must be applied in every sync path** (there may be multiple
pages with sync buttons — all must apply tombstones consistently).

### Sync Function Template

```ts
async function syncWithGitHub(cfg: GitHubConfig) {
  const { users: remoteUsers, sha: usersSha } = await fetchUsers(cfg)
  const tombstones = new Set(storage.loadDeletedUserIds())
  const filteredRemote = remoteUsers.filter((u) => !tombstones.has(u.id))
  const { users: localUsers } = useAppStore.getState()
  const allIds = new Set([...localUsers.map(u => u.id), ...filteredRemote.map(u => u.id)])

  const remoteEntries = []
  const entryShas: Record<string, string | null> = {}
  for (const uid of allIds) {
    const { entries: ue, sha } = await fetchEntries(cfg, uid)
    remoteEntries.push(...ue)
    entryShas[uid] = sha
  }

  mergeData(filteredRemote, remoteEntries.filter(e => !tombstones.has(e.userId)))
  const merged = useAppStore.getState()
  await pushUsers(cfg, merged.users, usersSha)
  for (const u of merged.users) {
    const ue = merged.entries.filter(e => e.userId === u.id)
    await pushEntries(cfg, u.id, ue, entryShas[u.id] ?? null, u.name)
  }
  storage.saveDeletedUserIds([])
  storage.saveGitHubConfig({ ...cfg, lastSynced: new Date().toISOString() })
}
```

---

## PWA Setup (vite.config.ts)

```ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#2d6a4f',
    background_color: '#0e1a11',  // matches dark mode --color-bg
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', purpose: 'any maskable' },
      { src: 'icons/icon-512.png', sizes: '512x512', purpose: 'any maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  },
})
```

**iOS standalone detection** — detect via `navigator.standalone` and add a
class to `<html>` so CSS can target PWA mode specifically:

```ts
// main.tsx
if ((navigator as any).standalone) document.documentElement.classList.add('ios-standalone')
```

---

## Charts — No Library

All charts are hand-rolled SVG inside React components. This keeps the bundle
small and gives full control over styling.

### Pattern

```ts
const PAD = { top: 24, right: 28, bottom: 28, left: 34 }
const VB_W = 360   // viewBox width — fixed, scales via width="100%"

// Coordinate helpers
const toX = (i: number) => PAD.left + (i / (n - 1)) * innerW
const toY = (v: number) => PAD.top + (1 - (v - minV) / range) * innerH
```

- `viewBox="0 0 360 {height}"` + `width="100%"` — responsive without JS.
- Catmull-Rom spline for smooth curves (see `catmullRomPath()`).
- Emoji labels at the end of each user's line (no legend overlap issues).
- One filled dot at the most recent data point only (not every point).
- Y-axis ticks: 3 values (max, mid, min). X-axis: up to 5 date labels.
- Grid lines: `strokeDasharray="3 4"`, `var(--color-border)`.

### Multi-series Comparison Chart Modes

```ts
type ChartMode =
  | 'absolute'   // raw values — only fair if units match
  | 'fromStart'  // each user's change from their own start/baseline
  | 'fromJoin'   // everyone reset to 0 at the newest member's first entry
  | 'weeklyDelta'// week-over-week change — compete on current pace
```

`fromJoin` is the fairest for groups where members joined at different times.
`weeklyDelta` lets a newcomer compete on recent momentum regardless of history.

---

## Key UX Patterns

### Inline Confirmation (no window.confirm)
Destructive actions (delete user) flip the card to a confirmation state in
place. Two-step: tap ✕ → card shows name + impact count → [Cancel] [Delete].

```tsx
{isRemoving ? (
  <div className="member-card__confirm">
    <p>Remove <strong>{user.name}</strong>? {n} entries will be deleted.</p>
    <button onClick={() => setRemovingId(null)}>Cancel</button>
    <button className="btn--danger" onClick={() => remove(user.id)}>Remove</button>
  </div>
) : (
  /* normal card content */
)}
```

### Save Flash Pattern (momentary confirmation)
Buttons use a `saved` state that auto-clears instead of navigation or toasts:
```ts
setSaved(true)
setTimeout(() => setSaved(false), 1500)
// Button: className={saved ? 'btn--saved' : 'btn--primary'}, text: saved ? 'Saved ✓' : 'Save'
```

### Unsaved Changes Pulse
Compute a `dirty` boolean by comparing form state to stored values. Apply
`.btn--pulse` (animated ring) to the save button when dirty.

### Section Descriptions
Every non-obvious section has a one-line `<p className="sync-hint">` below
its title explaining what the section does before the controls appear.

### Import / Export Symmetry
Any feature that lets data IN should have a matching feature that lets data
OUT in the same format. Export textarea: `readOnly`, `onFocus` auto-selects,
"Copy to Clipboard" button with flash confirmation.

### Data Source Status Card
Before any cloud-sync configuration UI, show the current data source state
(local-only / not yet synced / cloud synced / sync outdated) with contextual
cautions. Users need to understand the risk model before they configure it.

---

## Type Conventions

```ts
// IDs: crypto.randomUUID() — no external lib needed
// Dates: ISO string "YYYY-MM-DD" throughout, never Date objects in state
// Timestamps: full ISO string (new Date().toISOString()) for createdAt / lastSynced
// Nullability: explicit `| null`, never `undefined` in domain types
// Units: include unit in the type ('lbs' | 'kg'), format at display time
// Derived types: keep computed/derived types separate from raw domain types
```

---

## Things That Bit Us (Avoid These)

| Problem | Solution |
|---|---|
| `window.confirm` in a PWA | Inline confirmation state on the element |
| `position: sticky` tab bar on iOS | Fixed app shell, content scrolls inside |
| `height: 100vh` on iOS | `-webkit-fill-available` + ios-standalone class |
| Sync resurrecting deleted users | Tombstone IDs in localStorage, filter before merge |
| Multiple sync paths, only some with tombstones | One shared `syncWithGitHub()` function per page, or a shared service |
| `ghConfig` stale after sync (read at render time) | Fine — state changes trigger re-render which re-reads localStorage |
| Settings `lastSynced` state stale after cross-tab sync | Fine — routes unmount on navigation, state re-initializes on mount |
| `mergeData` adding remote-only users back after local delete | The tombstone pattern above |
| Chart library bundle size | Hand-rolled SVG — 0 KB, full control |
