# LearnMap.app — Changelog

## [Unreleased]

### Session persistence, completion rule, and log-from-notes (2026-07-07)
- Fixed: sessions could get logged out unexpectedly after some time despite refresh tokens existing. Root cause: refresh-token rotation revoked the previous token instantly, so two tabs/devices sharing one login (explicitly a design goal — ADR-010) whose access tokens happened to expire close together would race on `/auth/refresh`; the loser's request, carrying the now-superseded token, was rejected outright even though the session was never actually compromised. Fixed with a 30-second reuse grace window on rotation (ADR-031) — a well-established pattern (used by Supabase/GoTrue, among others) for exactly this race, without meaningfully weakening protection against a genuinely stolen token.
- Added: an item can only be marked complete if it has no sub-items, or every sub-item is already complete — attempting otherwise is rejected with a clear message ("complete every sub-item before marking this one complete"). Reopening a sub-item (or adding a new, incomplete one) now cascades a reopen up through any ancestor that was completed, since "all children completed" is no longer true for it either — otherwise a completed parent could silently end up with an incomplete child.
- Added: a "Log a session" action in the notes editor's "..." menu, alongside the existing "Add sub-item" — logging time no longer requires leaving the note to find the item in the tree first.

### Dashboard/Stats merge; Learning page favorites and layout rework (2026-07-07)
- Removed: the dedicated Statistics page (`/stats`) and its nav entry. Its Weekly/Monthly/Yearly toggle and trend chart now live directly on the Dashboard, replacing the old fixed-to-last-7-days "Weekly hours" chart — one page doing the job of two.
- Changed: any learning item can now be favorited, not just a top-level topic (`SetFavorite`'s root-only rejection removed, both backend and the frontend's star button). A favorited non-root item shows in the Favs tab as its own standalone entry — itself and its own descendants only, independent of its ancestors and siblings — instead of requiring a whole top-level topic. See ADR-030.
- Changed: a completed root topic no longer shows in Active or Favs — it moves to Completed only (reversing the earlier "Active shows everything regardless of status" choice). A favorited-and-completed topic keeps its favorite flag; it simply reappears in Favs automatically if reopened.
- Changed: Learning page tabs reordered to Favs/Active/Completed, and Favs is now the default tab (was Active).
- Changed: Learning page layout reorganized — added a page title (there wasn't one), moved the List/Map toggle and Trash link into a title row as page-level utility actions, grouped the tabs and search into their own row below it.

### Milestone 5 — Polish & Cross-Device QA (2026-07-07)
- Fixed: ProfilePage's dashboard/heatmap queries had no loading skeleton or error message (an empty-state audit gap).
- Fixed: `--success`/`--warning` failed WCAG AA contrast when used as text (they were designed for icon fills only) — added `--success-text`/`--warning-text`, darker steps of the same hue, applied to the handful of actual-text usages (completed-item strikethrough titles, "In progress" labels); icon fills unchanged.
- Fixed (found via a Playwright cross-device pass, substituting for physical-device testing): an app-wide scroll bug below the `md` breakpoint — every page was unscrollable on phone/narrow-tablet widths whenever content exceeded one viewport's height, because the app shell was `md:flex` and the inner scrollable container's `flex-1` never took effect below 768px.
- Fixed (same pass): a CSS Grid overflow on the Profile page (an unwrappable share-URL string forced the grid wider than a mobile viewport); the Learning page's search bar shrinking to an illegible sliver instead of wrapping; the Study Sessions header buttons overflowing off-screen instead of wrapping.
- Confirmed all 6 of DD_v1.pdf §17's Success Criteria are met against the current build.

### Milestone 4 — Charts & Statistics (2026-07-07)
- Added dedicated test coverage for `GET /stats?range=week|month|year` (scaffolded since Milestone 1, never had tests or a frontend consumer until now): aggregation math per range, invalid-range rejection, cross-user isolation.
- Chart-ified the Dashboard landing page: Weekly Hours (bar chart), Top Topics (ranked horizontal bar chart, replacing the old plain list), Completion % (a radial meter).
- Added a dedicated Statistics page (`/stats`) with a Weekly/Monthly/Yearly toggle (range lives in the URL, shareable) driving one area chart. New nav entry.
- Added `recharts` and a new `components/charts/` directory; extracted a shared `components/StatCard.tsx` (now used on both Dashboard and Profile).
- Fixed: Dashboard's 4-stat-card row truncated every label to a single letter around the tablet breakpoint (same root cause as the Profile grid-overflow fix below) — switched to `grid-cols-[repeat(auto-fit,minmax(...))]`.

### Study Sessions calendar, scheduling, and multi-topic sessions — stages 2-3 (2026-07-07)
- Completed the Study Sessions Teams-style calendar: defaults to Week view, visible current-day highlight, working Today/Back/Next navigation, scrolls to the current hour on load, a day-detail side panel (defaults to today, "No data available" when empty).
- Added scheduled sessions (honor-system completion) end to end: migrations `000009`/`000010` (scheduling columns + a relaxed hours constraint for the 0-hours pending state), `CreateScheduled`/`ConfirmScheduled` service methods, `POST /sessions/:id/confirm`.
- Added a confirm-timing gate (can't confirm before a session's scheduled window has started, enforced both server-side and in the UI) and a 5-minute "start now" grace window (picking "right now" as a start time shouldn't be rejected just because a few seconds pass before the request lands).
- Added multi-topic sessions: one session can cover more than one topic (new `study_session_topics` join table, migration `000011`, a `TopicMultiSelect` component); `TopTopics` now attributes a session's full hours to every topic it covers.
- Added the Dashboard's adaptive recent-activity window: shows today's activity if there's ≥10 items, otherwise expands to the past 7 days.
- Fixed several real bugs found via live verification during this work: a DB CHECK constraint rejecting the legitimate 0-hours pending-session state; a double-JSON-body-read bug from one handler calling another as a sub-handler; missing server-side past-date validation on scheduling; a stale-running-backend-container issue (same class as a prior incident — `go run` doesn't hot-reload) that made a fix look like it hadn't landed.

### Profile page redesign; public profile redesign (2026-07-07)
- Replaced the single long stacked-form Profile page with a two-column dashboard layout: an identity card (avatar/name/username/bio/socials/Edit-Share buttons, merged with the streak/stats hero — one avatar, not two) on the left, stat tiles/top-topics/activity heatmap on the right. Edit-profile and change-password forms moved into dialogs instead of always being rendered inline.
- Redesigned the public profile (`/u/:username`): a hero cover band with the avatar overlapping it, streak-rank and active-days stat tiles, a nicer tooltip-labeled socials row — replacing the previous flat centered gradient card.
- Fixed a CSS Grid track-sizing bug: an unwrappable long string (the share-profile URL) forced the grid wider than a mobile viewport, clipping/shifting all card content — same class of bug flagged as a past incident in ARCHITECTURE.md. Fixed with `min-w-0` on the grid items.

### Profile: heatmap, bio/socials, shareable public profiles (2026-07-07, stage 1 of a 3-part round)
- Added a GitHub-contribution-graph-style activity heatmap (`ContributionHeatmap`, custom-built) to the Profile page, backed by a new `GET /profile/heatmap` endpoint (365 days of daily study hours).
- Added bio, a chosen unique username, and six social links (LinkedIn/GitHub/Instagram/X/LeetCode/portfolio) to the profile. Added `react-icons` (brand logos only — lucide-react no longer ships those).
- Added shareable public profiles at `/u/:username`: public by default with an opt-out toggle, no auth required to view, shows avatar/bio/socials/streak-rank/heatmap only (never learning-item content). A private or nonexistent username both return an identical 404.
- New `users` columns (migration `000008`): `username` (unique, lowercased on write), `bio`, `social_links` (JSONB), `is_public`.

### Follow-up fixes: trash routing, numbering scope, Favs tab (2026-07-07)
- Fixed: "Empty Trash" and permanent delete appeared broken from the UI — actually a stale running backend container (routes were correct in code, just not yet restarted to pick them up); no code fix needed, just a restart.
- Changed: hierarchical numbering badges removed from the list and org-chart tree views — they now only appear in the notes focus-mode side tree, per direct feedback.
- Fixed: `NumberBadge` was a fixed-size circle that would clip longer labels; now grows into a pill for labels beyond 1-2 characters.
- Fixed: the export-as-markdown option was invisible, buried as one of four unlabeled icon buttons in the notes editor header. Consolidated into a single "..." dropdown with icon+text items (add sub-item, export note, export topic), matching the same discoverability fix already applied once this session to the tree row actions menu.
- Added a clear (X) button to the Learning page's search input.
- Changed: Learning page tabs redesigned — Active now shows every item regardless of status (previously it excluded completed ones); Completed is unchanged; added a new Favs tab, which — like Completed — is just a root-level filter over the same tree (a favorited top-level topic shows with its entire subtree, full List/Map toggle included), not a separate flat view.
- Added `is_favorite` on learning items end to end: migration, model field, `PATCH /items/:id/favorite` (server-side rejects favoriting anything but a top-level topic), and a hover-revealed star toggle on root-level tree rows only.

### Notes-system Todo pass, streak ranks, and focus mode (2026-07-07)
- Added a streak rank system (7 fire-themed tiers keyed off `current_streak`): badge on the Profile stat card, an all-ranks reference dialog, rank shown in the sidebar.
- Added focus mode for notes: fullscreen editing with a side tree of the whole topic, collapsible, defaulting to Preview. Renders via a `createPortal` straight onto `document.body` rather than through the Dialog primitive, after two CSS-based fullscreen attempts both proved unreliable in the browser.
- Fixed: Save while in focus mode now persists without exiting/closing (previously it always closed the editor, which read as "Save doesn't work" in focus mode).
- Added: mark-complete/reopen and "add sub-item" directly from the notes editor; Ctrl/Cmd+S; debounced auto-save (~2.5s idle); saving-on-close for any close path (Cancel, backdrop, Escape).
- Added hierarchical "1"/"1a"/"1a1" numbering badges across every tree view (list, org-chart, focus-mode side tree), including a collapsed thin-rail view.
- Added rich markdown: GFM tables/task-lists/strikethrough (`remark-gfm`), syntax-highlighted code blocks (`rehype-highlight`), image size presets (Small/Medium/Large/Original) via the standard markdown title-attribute slot — no raw HTML.
- Added copy-code "Copied!" confirmation; hid the markdown-help hint outside Write mode.
- Added trash "Empty Trash" and per-item permanent delete (both confirmed), plus an automatic 7-day retention sweep enforced lazily on read (no job scheduler in this project).
- Added functional breadcrumbs: every segment but the current page is a real link; the Learning page's Active/Completed tab and search moved from local state into URL search params so they're linkable.
- Added markdown export: a single note as a `.md` file, or a whole topic (root + descendants) as one combined `.md` "notebook" with a generated table of contents.
- Deferred (explicitly, with the user's input): an interactive/WYSIWYG-editable preview, PDF/DOCX/.zip export, and raw-HTML/drag-handle image resizing — all three would have reversed earlier deliberate lightweight-scope decisions. Drag-and-drop reordering of tree items was deferred separately as its own, larger feature.

### Post-Milestone-3 UX/feature pass (2026-07-07)
- Added a recycle bin: `GET /items/trash` and `POST /items/:id/restore` (mirrors Delete's cascade), a Trash page (`/trash`), and cache invalidation so deleting an item updates Trash without a manual refresh.
- Added a top-down org-chart view of the Learning page (`OrgChartTree`), toggled per-user preference alongside the existing indented list — both fully editable. Added an Active/Completed tab split on top-level topics, and moved search from global `AppLayout` chrome to a page-local control (it was inert on every page but Learning).
- Added a full notes feature: markdown + toolbar (bold/italic/H1/H2/code/image) with live preview in a large dialog; images upload from the device via a new `POST /uploads` endpoint (local disk storage — ADR-022); a root topic's notes auto-generate a table of contents from its sub-topics, each entry a hand-off to that sub-topic's own notes.
- Added a shareable Profile stat card (streak, most-time-spent topic, avatar) exportable as a PNG (`html-to-image`); ordinal joined-date wording; avatar now actually renders (was a write-only field before).
- Fixed: tree connector-line rendering bug and darkened the lines; org-chart horizontal scroll no longer expands the whole page layout (missing `min-w-0`); floating add button was missing a tooltip.
- Added Go tests for the upload endpoint (valid image, non-image rejection, SVG exclusion, oversized rejection, auth-required) and for trash/restore cross-user isolation.
- Added `backend/README.md` documenting exact local spin-up/restart/test steps.
- Initialized git for the repository (previously untracked).

### Milestone 3 — Study Sessions, Task Management & Profile (2026-07-06)
- Added item CRUD to the Learning Tree: add sub-item, rename, mark complete/reopen (status-toggle circle or actions menu), delete with a confirmation dialog that explains cascade behavior.
- Added the Study Sessions page: table view, "Add Session" dialog with a topic picker sourced from the learning tree, delete with confirmation.
- Added the Profile page: edit display name/avatar URL, change password. Profile edits now sync immediately into the nav sidebar via a new `updateUser` on the auth context.
- Wired the Dashboard to live `/dashboard` data: stat cards, top topics, today's sessions, recent activity.
- Added nav entries for Sessions and Profile (sidebar + phone bottom-tab-bar).
- Fixed (caught by `tsc`, pre-release): `z.coerce.number()` in the session form needed React Hook Form's input/output generic split; Base UI's dropdown-menu trigger uses a `render` prop, not Radix's `asChild`.

### Milestone 2 — Frontend Foundation, Navigation & Auth UI (2026-07-06)
- Added Vite + React 19 + TypeScript frontend scaffold with TailwindCSS v4 and shadcn/ui, design tokens matching the design doc's locked light-theme palette/typography/radius exactly.
- Added Register/Login pages (React Hook Form + Zod validation mirroring the backend), in-memory access token, silent-refresh-on-401 via an Axios interceptor.
- Added `ProtectedRoute`, redirecting unauthenticated users to `/login` and back to where they were headed.
- Added the mobile-first app shell: sidebar nav on tablet/desktop, bottom tab bar on phone, breadcrumb, search bar, and floating add button on every page.
- Added the Learning Tree page: client-side tree assembly from the flat `/items` list, expand/collapse persisted to localStorage, completed items rendered green with a checkmark, real empty state, and a "quick add" dialog for creating root-level items.
- Added `queryClient.clear()` on logout/failed-refresh so a shared browser never leaks a previous user's cached data.

### Milestone 1 — Backend Foundation + Auth (2026-07-06)
- Added PostgreSQL schema (versioned migrations): `users`, `refresh_tokens`, `learning_items`, `study_sessions`, `events`.
- Added authentication: register (invite-code gated), login, token refresh (rotating), logout (revocation) — bcrypt + JWT + httpOnly refresh cookie.
- Added learning item CRUD with hierarchy validation, status transitions, and cascade soft-delete of a subtree plus its sessions.
- Added study session CRUD with hours validation.
- Added `/dashboard` and `/stats` endpoints computing weekly hours, streak, completion %, top topics, and recent activity live per request.
- Added profile update and change-password endpoints.
- Added full middleware stack: JWT auth, CORS, auth-endpoint rate limiting, panic recovery, standard error envelope.
- Added automated test suite, including the mandatory cross-user data-isolation test.
- Fixed (pre-release, caught in review): dashboard's `todays_sessions` was serializing raw GORM model fields instead of the public API shape; event-recording failures were silently discarded instead of logged; error matching hardened via `errors.As`; `Logout` now verifies the refresh token belongs to the authenticated caller before revoking it (caught while building the Postman collection, regression-tested).
- Added `postman/LearnMap.postman_collection.json`: a full manual-testing collection (42 requests) covering every endpoint plus a dedicated cross-user isolation folder, verified via Newman (0 failures).

### Planning
- Initial architecture, database design, API contract, and milestone roadmap drafted from `docs/DD_v1.pdf`.
- Subagent roster established under `.claude/agents/`.
- **Scope revised:** hosted (not local), multi-user with authentication and profiles (not single-user/no-auth), PostgreSQL (not SQLite), responsive/mobile-first from Milestone 2 (not Milestone-5 polish). New deployment-agent and Milestone 6 (Deployment & Pilot Rollout) added.
- Phase 2 AI-readiness architecture documented (no code): AI service seam, Postgres-backed job queue, per-user usage tracking, pgvector reservation.
