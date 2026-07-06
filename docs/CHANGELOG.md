# LearnMap.app — Changelog

## [Unreleased]

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
