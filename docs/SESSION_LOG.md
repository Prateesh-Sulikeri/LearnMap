# LearnMap.app — Session Log

## 2026-07-06 — Planning session

**Summary:** Read project CLAUDE.md and `docs/DD_v1.pdf` (MVP v1 design document). Confirmed the repository was empty aside from those two files. Produced the full pre-implementation planning deliverable required by CLAUDE.md's Engineering Process (architecture review, subagent plan, folder structure, database design, API contracts, milestone roadmap, risks, recommended improvements) and presented it to the user for approval. No application code was written, per instructions.

**Files created:**
- `.claude/agents/database-agent.md`
- `.claude/agents/api-contract-agent.md`
- `.claude/agents/backend-agent.md`
- `.claude/agents/design-system-agent.md`
- `.claude/agents/frontend-agent.md`
- `.claude/agents/testing-agent.md`
- `.claude/agents/code-review-agent.md`
- `.claude/agents/docs-agent.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/PROJECT_STATUS.md`
- `docs/SESSION_LOG.md` (this file)
- `docs/CHANGELOG.md`

**Files modified:** None.

**Key implementation decisions:** See `docs/DECISIONS.md` (ADR-001 through ADR-006). Notably: flat-list tree assembly client-side, strict handler/service/repository layering, soft deletes, flat completion-% definition, session-based streak definition, `/api/v1` prefix.

**Problems encountered:** DD_v1.pdf underspecifies several product-level behaviors (delete semantics, completion % scope, streak definition, exact status enum values). Resolved by proposing explicit defaults rather than blocking, flagged clearly for user review.

**Problems resolved:** N/A (planning session, no bugs).

**Next recommended task:** Await user approval/feedback on the plan. On approval, begin Milestone 1 (Backend Foundation) with database-agent first (schema/models), then backend-agent (repositories/services/handlers).

---

## 2026-07-06 — Scope revision: hosted, multi-user, auth

**Summary:** User redirected scope mid-planning: LearnMap.app must be hosted and usable from phone + laptop, with authentication and profile sections, pilot-tested by multiple people on multiple screen sizes. User explicitly delegated the database engine choice. Decided PostgreSQL over SQLite (ADR-007) given hosted multi-user concurrent access. Updated schema (added `users`/`refresh_tokens`, UUID PKs, `user_id` scoping on all data tables), API contract (auth + profile endpoints, 401/403 codes), milestone roadmap (auth folded into Milestone 1, profile into Milestone 3, new Milestone 6 for deployment), and elevated responsive design to a Milestone-2 requirement instead of Milestone-5 polish. Added a ninth subagent (deployment-agent) and updated backend-agent, api-contract-agent, design-system-agent, frontend-agent, testing-agent, and code-review-agent charters accordingly.

**Files modified:**
- `.claude/agents/database-agent.md`, `backend-agent.md`, `api-contract-agent.md`, `design-system-agent.md`, `frontend-agent.md`, `testing-agent.md`, `code-review-agent.md`
- `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`

**Files created:**
- `.claude/agents/deployment-agent.md`

**Key implementation decisions:** See `docs/DECISIONS.md` ADR-007 through ADR-014 — Postgres, UUID PKs, versioned migrations, JWT + httpOnly-cookie auth, denormalized `user_id`, mobile-first responsive from Milestone 2, invite-code-gated registration for pilot, provider-agnostic containerized deployment.

**Problems encountered:** None blocking — all technical forks (auth transport, hosting provider) resolved with sensible, clearly-flagged defaults rather than blocking questions, consistent with the user's stated preference to delegate infra calls.

**Next recommended task:** Await user approval of the revised plan. On approval, begin Milestone 1 with database-agent (Postgres schema/migrations) followed by backend-agent (auth service first, since everything else depends on it).

---

## 2026-07-06 — Phase 2 AI-readiness architecture + AWS pilot hosting

**Summary:** User pushed back that the events-table/live-dashboard design "isn't scalable" given planned future AI features (Learning Generator, Task Breakdown, Explain Anything, Quiz Generator, more TBD — none finalized) and offered AWS free tier for pilot hosting. Clarified that Postgres itself wasn't the bottleneck; what was missing was a seam for AI work. Added architecture-only readiness (no implementation, no MVP scope change): a provider-agnostic `internal/services/ai/` seam, a Postgres-backed async job queue (`ai_jobs` table + `FOR UPDATE SKIP LOCKED` workers, avoiding new infra like Redis/SQS), per-user `ai_usage` tracking for future cost/rate control, and pgvector reserved for future embeddings (no separate vector DB needed later). Resolved the previously-open hosting-provider decision for the pilot specifically: single AWS free-tier EC2 instance running backend+Postgres containers, frontend on S3/CloudFront or Vercel.

**Files modified:** `docs/DECISIONS.md` (ADR-017 through ADR-021), `docs/ARCHITECTURE.md` (new §10 Phase 2 Architecture Readiness, pilot topology note), `docs/ROADMAP.md` (deferred ideas restructured to name the four AI features explicitly), `docs/PROJECT_STATUS.md`.

**Key implementation decisions:** See ADR-017–021. None of the new tables (`ai_jobs`, `ai_usage`) or the `internal/services/ai/` package are built yet — explicitly deferred until an AI feature is scoped and approved, to avoid building unused infrastructure now.

**Problems encountered:** Balancing "make this genuinely scalable for AI" against "don't build speculative features that aren't finalized" — resolved by adding only generic, feature-agnostic seams (job queue, usage table, provider interface) rather than any concrete AI feature schema/logic.

**Next recommended task:** Await user approval of the full plan (MVP + Phase 2 readiness + pilot hosting). On approval, begin Milestone 1 unchanged — Phase 2 readiness items are not part of Milestones 1-6.

---

## 2026-07-06 — Milestone 1 implementation: Backend Foundation + Auth

**Summary:** User approved building the MVP now, deploying the frontend on Vercel, deferring AI to later. Implemented all of Milestone 1 directly (the project's custom `.claude/agents/*.md` subagents turned out not to be invocable as `subagent_type` values in this environment — the Agent tool only exposes a fixed built-in roster — so each agent's charter was followed as the actual engineering spec while executing directly, rather than via separate spawned processes). Docker Desktop had to be started first (was installed but not running); Go itself was never installed on the host — all builds/tests/formatting ran inside `golang:latest` containers instead, keeping the host machine untouched.

Built: Go module + full folder skeleton, versioned Postgres migrations (`users`, `refresh_tokens`, `learning_items`, `study_sessions`, `events`), GORM models, repositories (every user-owned query scoped by `user_id`), services (auth with bcrypt+JWT+rotating httpOnly refresh cookie, learning item hierarchy/status/cascade-delete, study sessions, live dashboard/stats aggregation, append-only event log), handlers, full middleware stack (JWT auth, CORS, rate limiting, recovery, standard error envelope), and routes.

Verified in three passes: (1) manual end-to-end smoke test via curl against real Postgres — two users, full CRUD loop, direct cross-user attack attempts on items and sessions (rename/status-change/delete/read all correctly returned 404 with no side effects), token refresh and revocation, unauthenticated rejection; (2) automated test suite (service-layer + full-stack `httptest`) covering the same ground plus the streak algorithm, added as permanent regression coverage; (3) a self-run code review against `.claude/agents/code-review-agent.md`'s checklist, which caught and fixed two real issues.

**Files created:** ~30 files under `backend/` (`cmd/server/main.go`; `internal/{models,database,config,apperror,repositories,services,handlers,middleware,routes,testutil}/*.go`; `migrations/*.sql`; `go.mod`; `.env.example`; `.air.toml`) plus `docker-compose.yml` at the repo root.

**Files modified:** `.claude/agents/testing-agent.md` (documented the `go test ./... -p 1` requirement, discovered when parallel package tests deadlocked against the shared test Postgres database); `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, `docs/CHANGELOG.md` (Milestone 1 completion).

**Key implementation decisions:** UUID PKs via Postgres `gen_random_uuid()` (pgcrypto), golang-migrate for versioned SQL migrations, JWT access token (HS256) + SHA-256-hashed rotating refresh token in an httpOnly cookie, in-memory per-IP token-bucket rate limiting on `/auth/login` and `/auth/register` only, cascade soft-delete implemented by walking the flat item list in Go (BFS) rather than a recursive SQL CTE (ADR-001 reasoning extended to deletion).

**Problems encountered and resolved:**
- Docker daemon not running → started Docker Desktop, waited for it to come up.
- `golang-migrate/migrate/v4`'s latest version requires Go ≥1.24 → used `golang:latest` build image instead of pinning an older tag.
- Dashboard's `todays_sessions` field was serializing the raw GORM model (capitalized field names, leaked `DeletedAt`) instead of the same public DTO shape `/sessions` uses — caught during manual smoke testing, fixed by adding a handler-level response mapper.
- `go test ./...` deadlocked / hit FK violations across packages — root cause was Go's default cross-package test parallelism, with `internal/services` and `internal/handlers` tests both truncating the same shared Postgres database concurrently. Fixed by requiring `-p 1`; documented in testing-agent's charter.
- Event-recording failures were silently discarded (`_ = s.events.Record(...)` everywhere) — fixed by logging failures inside `EventService.Record` itself rather than touching every call site.

**Next recommended task:** Begin Milestone 2 (Frontend Foundation, Navigation & Auth UI) — Vite/React/TS scaffold, design tokens, Register/Login pages, protected routing, mobile-first app shell, Learning Tree page.

---

## 2026-07-06 — Postman collection + a Logout hardening fix

**Summary:** Built `postman/LearnMap.postman_collection.json`, a full manual-testing collection covering every Milestone 1 endpoint (health, auth, profile, items, sessions, dashboard/stats) plus a dedicated cross-user isolation folder. While designing it, realized Postman's cookie jar is shared per host rather than per logical user — registering Bob after Alice would overwrite Alice's refresh cookie — and that exposed a real (if minor) gap in `AuthService.Logout`: it revoked whatever refresh token was presented without checking it belonged to the Bearer-authenticated caller. Fixed by passing `userID` into `Logout` and only revoking a token if it matches; added a regression test (`TestLogout_CannotRevokeAnotherUsersRefreshToken`) proving Bob can't revoke Alice's session even with her cookie in hand.

**Files created:** `postman/LearnMap.postman_collection.json`, `postman/README.md`, `backend/internal/handlers/auth_test.go`.

**Files modified:** `backend/internal/services/auth_service.go` (`Logout` signature + ownership check), `backend/internal/handlers/auth_handler.go` (passes authenticated `user_id` through).

**Key implementation decisions:** Collection variables (not a separate environment file) so a single JSON import is self-contained; Register requests use a pre-request script to generate a unique email per run so the whole collection is safely re-runnable via Collection Runner.

**Problems encountered and resolved:** None blocking — full build/vet/fmt/test cycle stayed green throughout.

**Verification:** Full suite re-run (`go test ./... -p 1`) green including the new test. Collection itself run via Newman against the live backend: 42/42 requests, 71/71 assertions, 0 failures.

**Next recommended task:** Begin Milestone 2 (Frontend Foundation, Navigation & Auth UI).

---

## 2026-07-06 — Milestone 2 implementation: Frontend Foundation, Navigation & Auth UI

**Summary:** Scaffolded the frontend with Vite + React 19 + TypeScript, TailwindCSS v4, and shadcn/ui, mapping the design doc's locked light-theme palette/typography/radius onto shadcn's CSS variable structure (and removing the dark-mode block/`next-themes` dependency shadcn's init scaffolds by default, since the design doc explicitly excludes dark mode from the MVP). Built the full auth flow (Register/Login pages, in-memory access token, Axios interceptor with deduplicated silent-refresh-on-401, `ProtectedRoute`), the mobile-first `AppLayout` (sidebar on tablet/desktop, bottom tab bar on phone, breadcrumb/search/floating-add on every page), and the Learning Tree page (client-side tree assembly, localStorage-persisted expand/collapse, real empty state, a "quick add" dialog for creating root items).

Verification: `tsc -b && vite build` and `oxlint` both clean. Started the Vite dev server and confirmed it serves the correct app shell; the already-running backend container's own request logs showed a live register→me→dashboard sequence had already succeeded end to end. Attempted to set up headless-browser automation (`chromium-cli` unavailable; a Playwright scratchpad install was declined by the user) to independently re-verify the responsive breakpoint behavior — did not complete that specific check in this pass, and said so plainly rather than claiming full visual verification. Recommended a quick manual spot-check before Milestone 5's dedicated cross-device QA pass.

**Files created:** `frontend/` (full Vite/React/TS project — ~30 files: `src/{types,services,hooks,routes,layouts,pages,components,utils}/*`, shadcn `src/components/ui/*`, `index.css`, `main.tsx`, `App.tsx`, config files), `frontend/.env.example`, `frontend/.env.local`.

**Files modified:** `frontend/tsconfig.json` / `tsconfig.app.json` (path alias, then removed the now-deprecated `baseUrl` after `tsc` flagged it), `frontend/vite.config.ts` (Tailwind plugin + `@` alias), `frontend/src/components/ui/sonner.tsx` (dropped `next-themes`, hardcoded `theme="light"`).

**Key implementation decisions:** Access token in memory only, never localStorage (ADR-010); `queryClient.clear()` on logout/failed-refresh (client cache isolation, per the dashboarding discussion earlier this session); shared search-bar state passed to pages via React Router's `useOutletContext` rather than a global store; tree indentation uses a CSS custom property (`--depth`) scaled differently at `md:` so deep trees stay readable on phone.

**Problems encountered and resolved:** shadcn's `init` couldn't detect Tailwind until `src/index.css` had an `@import "tailwindcss"` line first — created a minimal one, then re-ran init successfully. TypeScript 6.0's `tsc` flagged `baseUrl` as deprecated — removed it, kept `paths` (works without it in bundler mode). `oxlint` (Vite's default linter here, not ESLint) came back clean aside from expected fast-refresh warnings in shadcn's own generated files and in `useAuth.tsx`'s colocated provider+hook export, both accepted idiomatic patterns, not fixed.

**Next recommended task:** Begin Milestone 3 (Study Sessions, Task Management & Profile) — item CRUD forms (rename/status/delete with confirmation), study session logging UI, profile page, dashboard wired to live data. Also: do the deferred manual responsive spot-check for Milestone 2 whenever convenient.

---

## 2026-07-06 — Milestone 3 implementation: Study Sessions, Task Management & Profile

**Summary:** Built out full item CRUD on the Learning Tree (per-node actions menu: add sub-item, rename, mark complete/reopen, delete-with-confirmation), the Study Sessions page (table + add/delete), the Profile page (edit + change password), and wired the Dashboard stub from Milestone 2 to live `/dashboard` data. `ItemFormDialog` is shared across "quick add" (root item), "add sub-item" (nested), and "rename" — replaced the Milestone 2 `QuickAddDialog` with it rather than keeping near-duplicate dialogs. Added `updateUser` to the auth context so a profile edit reflects immediately in the sidebar without a refetch.

Hit two real TypeScript errors during the build that were worth understanding rather than working around: (1) `z.coerce.number()` on the session-hours field needs React Hook Form's newer three-generic `useForm<Input, Context, Output>` form, because RHF's internal field state is pre-coercion (string) while the resolver's validated output is post-coercion (number) — using one type for both doesn't typecheck. (2) shadcn's dropdown-menu here is built on Base UI (not Radix — confirmed via `@base-ui/react` in package.json), which composes custom trigger elements via a `render={<Button />}` prop instead of Radix's `asChild` convention; fixed by checking how shadcn's own `alert-dialog.tsx`/`dialog.tsx`/`select.tsx` did it and matching that idiom.

**Verification:** `tsc -b && vite build` and `oxlint` both clean (same three pre-existing/idiomatic warnings as Milestone 2, no new ones). Manually cross-checked every new frontend API call's field names against the actual Go DTOs (sessions, profile, dashboard) rather than assuming — all matched. Did not re-attempt browser automation for a full click-through after the user declined the Playwright scratchpad setup during Milestone 2; this is the same residual verification gap carried forward, now spanning Milestones 2 and 3, flagged again for a manual pass before Milestone 5.

**Files created:** `frontend/src/services/{sessionsApi,dashboardApi,profileApi}.ts`, `frontend/src/components/{ItemFormDialog,DeleteItemDialog,AddSessionDialog,DeleteSessionDialog}.tsx`, `frontend/src/pages/{StudySessionsPage,ProfilePage}.tsx`.

**Files modified:** `frontend/src/types/api.ts` (StudySession/Dashboard/Stats/Profile types), `frontend/src/hooks/useAuth.tsx` (`updateUser`), `frontend/src/components/TreeNode.tsx` (full actions menu + status toggle), `frontend/src/layouts/AppLayout.tsx` (Sessions/Profile nav entries, switched to `ItemFormDialog`), `frontend/src/pages/DashboardPage.tsx` (replaced stub with live data), `frontend/src/App.tsx` (new routes). Removed `frontend/src/components/QuickAddDialog.tsx` (superseded).

**Key implementation decisions:** One shared `ItemFormDialog` for create/rename rather than three near-identical dialogs; `Controller` (not `register`) for the shadcn `Select` in the session form since it's not a native input; delete confirmations phrase the "can't be undone" warning honestly relative to the soft-delete architecture (reversible in the DB in principle, but there's no undo UI, so it's final from the app's perspective).

**Next recommended task:** Begin Milestone 4 (Charts & Statistics) — Recharts for weekly/monthly hours, top topics, completion %, wired to the already-live `/stats` endpoint. Also still pending: the manual browser click-through + responsive spot-check for Milestones 2-3.
