# LearnMap.app — Changelog

## [Unreleased]

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
