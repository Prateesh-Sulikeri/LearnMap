# LearnMap.app — Roadmap

> Scope updated 2026-07-06: hosted, multi-user, auth + profiles, PostgreSQL. See `docs/DECISIONS.md` ADR-007+.

## Completed Milestones

**Milestone 0 — Planning & Setup**
- Design document analyzed, ambiguities resolved, subagent roster defined, scope revision (hosted/multi-user/auth/Postgres) incorporated, plan approved 2026-07-06.

**Milestone 1 — Backend Foundation + Auth** (completed 2026-07-06)
- Go module + folder scaffolding per ARCHITECTURE.md, plus `internal/apperror` (typed service errors) and `internal/testutil` (test DB helper) added during implementation
- PostgreSQL via versioned golang-migrate SQL migrations (not GORM AutoMigrate, per ADR-009)
- GORM models: `users`, `refresh_tokens`, `learning_items`, `study_sessions`, `events` — UUID PKs, soft deletes, `user_id` on every user-owned table
- Auth service (bcrypt + JWT access token + rotating httpOnly refresh cookie), invite-code-gated registration, profile update/change-password
- Learning item hierarchy CRUD + status transitions + cascade soft-delete; study session CRUD; live dashboard/stats aggregation
- Full middleware stack: JWT auth, CORS (explicit origins), rate limiting on auth endpoints, panic recovery, standard error envelope
- Automated tests (service + full-stack `httptest`) including the mandatory two-user cross-user isolation test; manual end-to-end verification against real Postgres
- Exit criteria met: `go build`/`go vet`/`gofmt` clean, all tests green (`go test ./... -p 1`), code-reviewed (two fixes applied: event-write failures now logged instead of silently swallowed; error matching switched to `errors.As` for robustness)

**Milestone 2 — Frontend Foundation, Navigation & Auth UI (mobile-first)** (completed 2026-07-06)
- Vite + React 19 + TS scaffold; TailwindCSS v4 tokens mapped onto shadcn/ui (light theme only); shadcn/ui init with button/input/label/card/dialog/dropdown-menu/skeleton/sonner/separator/badge
- Register / Login pages (RHF + Zod, mirrors backend validation); Axios client with bearer-token attach + silent-refresh-on-401 (deduplicated across concurrent requests)
- ProtectedRoute wrapper; redirect unauthenticated users to `/login` and back
- App shell responsive: left sidebar (tablet/desktop) collapses to a bottom tab bar (phone); search bar, breadcrumb, floating add button on every page
- Learning Tree page: fetch `/items`, assemble tree client-side, expand/collapse persisted to localStorage, indentation adapts on phone widths, completed items green+checkmark, real empty state
- Exit criteria: typecheck/build/lint clean. Backend request logs confirm a real register→me→dashboard flow succeeded end to end; responsive breakpoint behavior verified via code review and dev-server checks but not independently re-confirmed with browser automation in this pass (tooling wasn't set up) — flagged for a spot-check before Milestone 5's dedicated cross-device QA.

**Milestone 3 — Study Sessions, Task Management & Profile** (completed 2026-07-06)
- Item CRUD: add sub-item, rename, mark complete/reopen, delete-with-confirmation — all via a per-node actions menu plus a status-toggle circle, wired through `ItemFormDialog` (shared create/rename) and `DeleteItemDialog`
- Study Sessions page: table, "Add Session" dialog (topic/hours/date/notes), delete with confirmation
- Profile page: display name/avatar URL edit (synced live into the nav via `updateUser`), change password
- Dashboard wired to live `/dashboard` data: stat cards, top topics, today's sessions, recent activity
- Exit criteria: build/typecheck/lint clean; API contract cross-checked field-by-field against the backend DTOs. Full click-through (create→track→complete→log-session, two-account isolation) not independently re-verified via browser automation in this pass — same tooling gap as Milestone 2, flagged for a spot-check before Milestone 5.

**Post-Milestone-3 UX/feature pass** (completed 2026-07-07, interstitial — not a numbered milestone)
- Recycle bin (`/items/trash`, restore), top-down org-chart tree view + Active/Completed tabs on the Learning page, full markdown notes with device image upload + auto-generated table of contents, shareable Profile stat card exportable as an image
- Driven directly by the user testing the running Milestone-3 build; see `PROJECT_STATUS.md` and ADR-022 for detail

**Milestone 4 — Charts & Statistics** (completed 2026-07-07)
- `/stats?range=week|month|year` (scaffolded since Milestone 1, first dedicated test coverage added now): exact aggregation math per range, invalid-range rejection, cross-user isolation
- Dashboard landing page chart-ified per DD_v1.pdf's own layout: Weekly Hours (bar), Top Topics (ranked horizontal bar, replacing the plain list), Completion % (a radial meter — a single ratio against a limit isn't a pie-chart job)
- New dedicated Statistics page (`/stats`) with a Weekly/Monthly/Yearly toggle (range lives in the URL) driving one area chart; new nav entry
- Recharts added; new `components/charts/` + shared `components/StatCard.tsx`
- Exit criteria met: charts render live per-user data (verified via curl math checks and Playwright screenshots), animate on load (Recharts default), responsive at phone/tablet/laptop (verified via Playwright)

**Milestone 5 — Polish & Cross-Device QA** (completed 2026-07-07)
- Audited empty/loading/error states on every page; fixed the one real gap found (ProfilePage's dashboard/heatmap queries)
- Color-contrast audit (computed WCAG ratios for every semantic token pair): found and fixed success-green/warning-orange failing AA as text (they were designed for icon fills, reused for text too) — added `--success-text`/`--warning-text`, left icons on the original tokens
- Cross-device QA: real physical-device testing isn't possible in this environment — substituted with Playwright driving the live dev server at phone/tablet/laptop widths across every page. Found and fixed three real layout bugs this way: an app-wide scroll bug below the `md` breakpoint (the shell's `md:flex` meant the scrollable container's `flex-1` never took effect below 768px), a CSS Grid overflow on Profile (an unwrappable URL forcing the grid wider than the viewport), and two header/search-bar overflow bugs (Learning, Study Sessions)
- Final QA against DD_v1 §17 Success Criteria: all 6 confirmed substantively met against the current build

## Current Milestone

### Milestone 6 — Deployment & Pilot Rollout (not started — **the project is not deployment-ready**)
- Dockerfiles (backend multi-stage build) + `docker-compose.yml` for local dev parity (Postgres + backend + frontend)
- Provision managed Postgres; deploy backend container and frontend static build
- Custom domain / HTTPS, CORS allow-list for the real deployed origin(s), production secrets (`JWT_SECRET`, `DATABASE_URL`, invite code)
- Smoke test from a real phone browser and laptop browser over the internet
- Basic structured logging; distribute invite code + pilot accounts to testers

## Deferred Ideas (explicitly out of MVP scope)

### Phase 2 — AI features (not finalized, architecture readiness only — see ARCHITECTURE.md §10)
- Learning Generator
- Task Breakdown
- Explain Anything
- Quiz Generator
- others TBD

The `events` table, per-user scoping, and the AI seam/job-queue/usage-tracking groundwork (ADR-017–020) all exist specifically so these can be built later without an architectural rewrite. None are scheduled or scoped yet.

### Other deferred ideas
- Native mobile app
- Collaboration/shared workspaces between users (each pilot tester's data stays private to them)
- OAuth/social login, email verification, "forgot password" email flow (defer past pilot — manual reset by admin if needed during pilot)
- Drag-and-drop manual reordering (schema has a `position` column reserved for this)
- Avatar file upload (profile still uses a URL field; notes gained device image upload during the post-M3 pass — see ADR-022 — but that storage is local-disk, not yet reused for avatars)
- Syntax highlighting / GFM tables in the notes markdown editor (plain CommonMark only for now — see ADR/ARCHITECTURE notes on the notes editor)
