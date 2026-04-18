# Functionality Snapshot — lb-tracker

Pre-overhaul behavioral contract. Every checkbox must pass after the visual
overhaul is complete. Visual appearance may change; behavior must not.

---

## Login Screen (EmojiLogin)

### First load / no profile
- [ ] Shows login screen when no `activeUserId` in localStorage
- [ ] Shows login screen when `activeUserId` refers to a deleted user

### Pick existing profile
- [ ] Displays all existing users with their emoji + name
- [ ] Clicking an existing user card logs in and routes to Dashboard
- [ ] Active user is stored in localStorage as `lb-tracker:activeUserId`

### Create new profile — emoji step
- [ ] "Add new" / "+" button opens emoji picker grid
- [ ] Emojis already used by existing users are not shown
- [ ] Clicking an emoji advances to name step

### Create new profile — name step
- [ ] Name input is focused automatically
- [ ] Submitting blank name shows error "Please enter your name."
- [ ] Name matching an existing user (case-insensitive) activates that user instead of creating duplicate
- [ ] Valid name + emoji creates a new user and logs in
- [ ] New user appears in Group page member list

---

## Layout / Navigation

### Tab bar
- [ ] Five tabs visible: Home, Profile (or active user name), Battle, Group, Settings
- [ ] Tapping a tab navigates to the correct route
- [ ] Active tab is visually distinguished
- [ ] Profile tab label shows the active user's name when logged in
- [ ] Bottom safe-area padding respected (iOS standalone)

---

## Dashboard (Home tab — `/`)

### Header
- [ ] Shows active user emoji + name
- [ ] Shows today's date in human-readable format (e.g. "Friday, April 18")
- [ ] "Logged" badge appears when at least one entry exists for today
- [ ] Sync button (↻) visible only when GitHub token is configured

### Quick-log form
- [ ] Input accepts decimal numbers (`inputmode="decimal"`, `step="0.1"`)
- [ ] Input range: min 20, max 1500 — values outside this range are silently rejected
- [ ] Non-numeric input is silently rejected
- [ ] Save button disabled when input is empty
- [ ] Successful save: button flashes "✓", input clears after ~1.4s
- [ ] Saving today's second entry is allowed (multiple readings per day)
- [ ] Placeholder shows last logged value when already logged today

### Adjust recent values (ExpandLog modal)
- [ ] "Adjust recent values" button opens the ExpandLog modal
- [ ] Modal shows 8 rows: Today + last 7 days, each with date label + weight input
- [ ] Existing entries pre-populate their row's input
- [ ] Editing a row and saving updates the entry in the store
- [ ] Blanking a row that had an entry deletes that entry
- [ ] "Cancel" closes without saving
- [ ] "Save All" commits all changes and closes after ~700ms
- [ ] Body scroll is locked while modal is open
- [ ] Clicking the backdrop closes the modal

### Chart
- [ ] Renders an SVG line chart of weekly averages
- [ ] Overlays faint raw daily entry dots/line beneath the weekly line
- [ ] Shows "Log entries to see your trend" when no data exists
- [ ] Shows "No entries in this period" when timeframe filter is active but has no data
- [ ] Timeframe buttons: All / 1Y / 6M / 1M filter the visible range correctly
- [ ] Active timeframe button is visually distinguished
- [ ] Gap detection: weeks with >31-day gap shown with dashed connector
- [ ] Single-data-point does not crash (synthesizes a 2-point array)

### Stats grid (dimmed until first entry)
- [ ] "Weekly Avg" card: shows current week's average weight + entry count
- [ ] "Weekly Avg" sub-label shows days remaining in the week, or "ends today"
- [ ] "vs Last Week" card: shows delta from previous week, colored green (down) or red (up)
- [ ] "vs Last Week" sub-label shows previous week's average
- [ ] "Total Lost" card: shows cumulative change all-time (negative = loss)
- [ ] "Streak" card: shows number of consecutive weeks with entries
- [ ] Stats section dimmed (opacity + pointer-events: none) when no entries exist

### Goal progress bar
- [ ] Visible only when user has set a goal weight AND has a current-week average
- [ ] Bar fill percentage = (start − current) / (start − goal) × 100, capped at 100%
- [ ] Shows start weight label, percentage label, goal weight label
- [ ] Has correct ARIA role=progressbar with aria-valuenow

### Weekly history list
- [ ] Shows up to 8 most recent weekly averages, newest first
- [ ] Each row shows week date range, average weight, delta from prior week
- [ ] Delta colored green (down) or red (up)
- [ ] List hidden when no weekly averages exist

### Quick sync (Dashboard header)
- [ ] Sync button spins while syncing
- [ ] On success: button flashes green "ok" state, then returns to normal
- [ ] On error: button flashes red "err" state
- [ ] Sync performs bidirectional merge (fetch remote → merge → push merged)

---

## Profile page (`/profile`)

### Header
- [ ] Shows "Profile" title + user emoji + name
- [ ] Save icon (floppy disk) pulses when name or color has unsaved changes
- [ ] Save icon shows "✓" briefly on save
- [ ] GitHub sync button visible and functional when token is configured

### Identity section
- [ ] Name input pre-filled with current name
- [ ] Editing name and saving persists to store
- [ ] Favorite color: text input accepts 7-char hex code (#rrggbb)
- [ ] Hex input shows the color as its own text color when valid
- [ ] Color swatch button opens native color picker
- [ ] Random color button (🎲) sets a random valid hex
- [ ] Invalid hex color is stored as null

### Trend section (≥2 weekly averages required)
- [ ] Shows rate per week (lbs/week), colored green (losing) or red (gaining)
- [ ] Shows projected goal date when trend is negative AND goal weight is set
- [ ] Shows "Goal reached! 🎉" when current weight ≤ goal weight
- [ ] Shows "Set a consistent pace…" when no reliable trend yet
- [ ] Shows "Set a goal weight in Settings…" when no goal is configured

### BMI section (height in Settings + at least one entry required)
- [ ] Shows BMI value to 1 decimal place
- [ ] Shows category tag: Underweight / Normal / Overweight / Obese with distinct colors
- [ ] Shows weight thresholds for each BMI category in current unit
- [ ] Active BMI category row is highlighted
- [ ] Shows weight delta to enter/exit each range
- [ ] Prompt to enter height when height is missing
- [ ] Prompt to log weight when no entries exist

### Stats Lab (≥2 weekly averages required)
- [ ] OLS regression section: slope, 95% CI, p-value, t-stat, R², adj. R², RSE
- [ ] Significance codes: *** / ** / * / ns displayed per test
- [ ] Mann-Kendall test: S, τ, z, p-value
- [ ] Runs test: runs count, n₊, n₋, z, p-value
- [ ] Descriptives: mean, SD, CV, range, skewness
- [ ] Info (ⓘ) tooltips expand/collapse on click per section
- [ ] Residual vs Time plot renders (≥3 weekly averages)
- [ ] Normal Q-Q plot renders (≥5 weekly averages)
- [ ] ACF correlogram renders (≥1 weekly average)

---

## Group page (`/group`)

### Member list
- [ ] Shows all users as member cards
- [ ] Each card shows emoji avatar, name, unit, last-logged date (relative: "today", "yest.", "Xd ago", "Xw ago")
- [ ] Each card shows current week average + delta (colored)
- [ ] Active user card has a distinct highlight border + "Active" badge
- [ ] Remove button (✕) hidden for the active user

### Switch active user
- [ ] Clicking a non-active member card switches the active user
- [ ] Dashboard immediately reflects the new active user's data
- [ ] `activeUserId` updates in localStorage

### Remove member
- [ ] Clicking ✕ on a non-active member shows inline confirmation
- [ ] Confirmation shows entry count to be deleted
- [ ] "Cancel" returns to normal card state
- [ ] "Remove" deletes the user and all their entries from the store
- [ ] Removed user is added to the deleted-user tombstone list (prevents sync resurrection)
- [ ] Active user cannot be removed

### Add member inline form
- [ ] "+ Add Member" button shows add form
- [ ] Emoji picker shows only unused emojis
- [ ] Name input required (error shown on empty submit)
- [ ] Entering an existing name (case-insensitive) activates that user instead of duplicating
- [ ] Valid new member is added and form closes
- [ ] "Cancel" hides form without changes

### Utilities
- [ ] "De-duplicate members" button appears when >1 user exists
- [ ] Last synced timestamp shown at bottom when GitHub sync has run
- [ ] Save icon (floppy) pushes members to GitHub when clicked
- [ ] Sync button (↻) performs bidirectional sync

---

## Battle page (`/battle`)

### With one user
- [ ] All four chart modes (Absolute, From Start, From Join, Weekly Delta) show a "locked" placeholder
- [ ] Placeholder message prompts to add more members

### With two or more users
- [ ] "Absolute" mode: multi-series chart shows actual weight values per user
- [ ] "From Start" mode: chart shows cumulative change from each user's first entry
- [ ] "From Join" mode: chart aligns all users to a common start date (series start at 0)
- [ ] "Weekly Delta" mode: shows week-over-week change per user
- [ ] Timeframe buttons (All / 1Y / 6M / 1M) filter the chart correctly
- [ ] Each user's line uses their favoriteColor (or fallback from FALLBACK_COLORS array)
- [ ] Legend shows each user's emoji + name with their color swatch
- [ ] Chart handles missing/null weeks (no crash, no rendering artifact)

---

## Settings page (`/settings`)

### Header
- [ ] Shows "Settings" title + user emoji + name
- [ ] Floppy save icon pulses when form is dirty
- [ ] Floppy save icon shows "✓" briefly after save
- [ ] Sync button (↻) visible in header when token is entered

### Body & Goals form
- [ ] Height: two inputs (ft + in), numeric keyboard
- [ ] Gender: three toggle buttons (Male / Female / Other), toggles off on re-click
- [ ] Starting weight input (decimal)
- [ ] Goal weight input (decimal)
- [ ] Week starts on: day picker (Sun–Sat), single-select
- [ ] "Save Settings" button persists all fields to store
- [ ] "Saved ✓" flash after successful save
- [ ] Form resets to stored values after a GitHub sync completes

### Modify values (entry editor)
- [ ] "View all N entries" button opens modal when entries exist
- [ ] "No entries yet" placeholder when no entries
- [ ] Modal lists entries grouped by month, newest first
- [ ] Each entry row shows date, day name, weight
- [ ] Clicking an entry opens edit view (date, weight input, Save/Delete/← Back)
- [ ] Save updates the entry; Delete removes it (with browser `confirm()` dialog)
- [ ] Edit view shows "Saved ✓" briefly then returns to list view
- [ ] Clicking backdrop closes the modal

### Export Records
- [ ] Shows count of entries
- [ ] Read-only textarea shows all entries in `yyyy-mm-dd,weight` format, sorted oldest first
- [ ] Clicking textarea selects all text
- [ ] "Copy to Clipboard" button copies text and flashes "Copied ✓"

### Import Records
- [ ] Textarea accepts multiline `yyyy-mm-dd,weight` format
- [ ] "Import" button disabled when textarea is empty
- [ ] Valid lines are added as entries; invalid lines skipped
- [ ] Result message: "Imported N entries (X skipped)" or "Nothing imported · X lines couldn't be parsed"
- [ ] After successful import, textarea clears

### Data Source status card
- [ ] "Local storage only" badge + 4 caution notes when no GitHub config
- [ ] "Not yet synced" badge + 2 notes when token set but no sync yet
- [ ] "Sync outdated" badge + 3 notes when last sync >24h ago
- [ ] "Cloud synced" badge + 3 notes when synced recently

### GitHub Sync section
- [ ] Repository input (owner/repo format)
- [ ] Personal Access Token input (password masked by default)
- [ ] Show/hide toggle (👁 / 🙈) for token
- [ ] "Create token ↗" link opens GitHub PAT page in new tab
- [ ] "Sync Now" button disabled when token or repo is empty
- [ ] Sync performs bidirectional merge (fetch → merge → push)
- [ ] Error message displayed on sync failure
- [ ] "Last synced X ago" shown on success
- [ ] Token + repo + timestamp persisted to `lb-tracker:ghConfig` in localStorage

---

## Dark mode

- [ ] `@media (prefers-color-scheme: dark)` switches entire palette
- [ ] Chart lines and axes readable in dark mode
- [ ] All text meets contrast requirements in dark mode
- [ ] Modal, bottom sheet, tab bar use dark surface colors
- [ ] BMI tag colors distinct in dark mode

---

## PWA / Offline

- [ ] Service worker registers on install
- [ ] App shell loads from cache when offline
- [ ] Manifest `theme_color` matches design primary color
- [ ] iOS standalone mode: status bar blends with app header
- [ ] iOS standalone mode: bottom home-indicator area is clear of interactive elements
- [ ] App is installable on Android (manifest + SW present)

---

## Data persistence

- [ ] All user data persists across hard page reloads (localStorage)
- [ ] `lb-tracker:users` key stores all user objects
- [ ] `lb-tracker:entries` key stores all weight entries
- [ ] `lb-tracker:activeUserId` key tracks active user
- [ ] `lb-tracker:ghConfig` key stores GitHub config
- [ ] `lb-tracker:deletedUserIds` key tracks tombstoned user IDs

---

## Accessibility (baseline)

- [ ] Tab bar has `role="navigation"` and `aria-label="Main navigation"`
- [ ] Goal progress bar has `role="progressbar"` with `aria-valuenow/min/max`
- [ ] Modal dialogs have `role="dialog"` and `aria-modal="true"`
- [ ] Sync buttons have `aria-label`
- [ ] Form inputs have associated `<label>` elements
- [ ] Color alone is not the only indicator of weight direction (text label also present)
