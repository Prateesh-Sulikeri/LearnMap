# LearnMap.app — Architecture

Status: **Milestones 1-5 complete** (backend foundation, frontend, study sessions/profile, charts & statistics, polish & cross-device QA). Milestone 6 (deployment) not started — **the project is not deployment-ready.**

> **Scope note (2026-07-06):** the original design document (`docs/DD_v1.pdf`) specified a local, single-user, SQLite-backed tool with no auth. The user has since directed that LearnMap.app be **hosted, multi-user, with authentication and profiles**, usable from a phone and a laptop, with pilot testing across multiple people and screen sizes. This document reflects the updated scope. See `docs/DECISIONS.md` ADR-007 onward.

## 1. System Overview

```
┌──────────────────┐        HTTPS/JSON        ┌──────────────────────┐        ┌────────────────┐
│  frontend (SPA)   │ ───────────────────────► │   backend (Gin)      │───────►│  PostgreSQL     │
│  React + TS        │ ◄─────────────────────── │   Go                 │◄───────│  (managed)      │
│  phone + laptop    │   Bearer JWT + httpOnly  │   /api/v1/*          │  GORM  │                 │
└──────────────────┘   refresh cookie          └──────────────────────┘        └────────────────┘
```

Frontend and backend remain independently deployable. The backend is now the sole authority on identity (auth) and data ownership (every row is scoped to a `user_id`).

## 2. Backend Architecture (layered)

```
cmd/
  server/main.go            entrypoint: load config, init DB, build router, run

internal/
  models/                   GORM structs — owned by database-agent
    user.go
    refresh_token.go
    learning_item.go
    study_session.go
    event.go

  database/                 connection, PRAGMAs/pooling — owned by database-agent
    connection.go
  migrations/                versioned SQL migrations (golang-migrate/goose) — owned by database-agent

  apperror/                  typed service-layer errors (Validation/NotFound/Unauthorized/Conflict);
                              handlers translate these into the standard JSON error envelope

  repositories/              ONLY layer touching the DB — owned by backend-agent
    user_repository.go
    refresh_token_repository.go
    learning_item_repository.go
    study_session_repository.go
    event_repository.go

  services/                  ALL business logic lives here — owned by backend-agent
    auth_service.go            (register/login/refresh/logout, bcrypt, JWT)
    profile_service.go
    learning_item_service.go   (hierarchy validation, cascade soft-delete, status transitions, trash list/restore)
    study_session_service.go   (session CRUD, streak calc)
    dashboard_service.go       (aggregation: weekly hours, completion %, top topics)
    event_service.go           (append-only event log writer)
    upload_service.go          (image uploads for notes — local disk, see ADR-022)

  handlers/                  HTTP only: parse request → call service → write response
    auth_handler.go
    profile_handler.go
    learning_item_handler.go
    study_session_handler.go
    dashboard_handler.go
    upload_handler.go
    health_handler.go

  routes/
    routes.go                  route table; public routes (auth) vs. protected routes (auth middleware required)

  middleware/
    cors.go
    auth.go                    verifies JWT, injects user_id into context; 401 on failure
    rate_limit.go               IP-based limiter on /auth/login, /auth/register
    logging.go
    recovery.go
    error_handler.go

  config/
    config.go                  env-driven config (port, DATABASE_URL, JWT_SECRET, CORS origins)

  testutil/                  test-only: real (not mocked) Postgres connection + truncate helper for tests
```

Key dependencies (Milestone 1): `gin-gonic/gin`, `gorm.io/gorm` + `gorm.io/driver/postgres`, `golang-jwt/jwt/v5`, `golang.org/x/crypto/bcrypt`, `golang.org/x/time/rate` (auth rate limiting), `golang-migrate/migrate/v4` (SQL source), `google/uuid`, `gorm.io/datatypes` (JSONB), `joho/godotenv` (local dev only).

**Rule enforced every milestone (self-reviewed for M1, no separate agent process available in this environment):** handlers never import GORM directly; repositories never contain conditional business rules; every user-owned-table query is scoped by `user_id` from the auth context — never from client input. Verified in Milestone 1 by an automated cross-user isolation test (`internal/handlers/isolation_test.go`) in addition to manual end-to-end verification.

## 3. Frontend Architecture

```
frontend/src/
  components/
    tree/              TreeNode (editable indented list) + TreeGuides (connector lines), OrgChartTree/
                       OrgChartNode (top-down org-chart view), NoteIndicator (notes trigger button)
    notes/             NotesEditorDialog (markdown + toolbar + preview + TOC), MarkdownToolbar,
                       MarkdownPreview
    profile/           ProfileStatCard (streak/stats hero, embeddable — exposes exportAsImage() via a
                       ref, not its own <Card>), EditProfileDialog, ChangePasswordDialog
    charts/            ChartTooltip (shared, matches card/popover styling), WeeklyHoursChart,
                       TopTopicsChart, CompletionMeter (a radial meter, not a pie), HoursTrendChart
                       (single-series area chart, reused for week/month/year on the Statistics page)
    StatCard.tsx        shared stat-tile (icon + value + label), used on Dashboard and Profile
    TopicMultiSelect.tsx a session can cover more than one topic — built on the existing
                       DropdownMenuCheckboxItem, no new dependency
    ItemFormDialog, DeleteItemDialog, AddSessionDialog, ScheduleSessionDialog, ConfirmSessionDialog,
                       SessionDetailsDialog, DeleteSessionDialog — CRUD/scheduling dialogs
  pages/              Login, Register, Dashboard, LearningTree, StudySessions, Statistics, Profile, Trash
  layouts/            AppLayout (nav + breadcrumb + floating add button); AuthLayout
  routes/              route table incl. a ProtectedRoute wrapper (redirect to /login if unauthenticated)
  hooks/               useAuth, useLearningTree, useCollapsedState/useSidebarCollapsed/useTreeViewMode (localStorage)
  services/            one file per API resource; TanStack Query hooks + Axios calls live here ONLY
    authApi.ts          register/login/refresh/logout/me — manages access token in memory
    itemsApi.ts          also list/restore trash
    sessionsApi.ts       includes confirm() for the honor-system scheduling flow
    dashboardApi.ts      also getStats(range) for the Statistics page
    profileApi.ts
    uploadsApi.ts        image upload for notes (multipart)
    client.ts            axios instance: attaches Bearer token, `withCredentials: true` for the refresh cookie, 401 → single silent refresh attempt → else logout; exports API_ORIGIN for resolving root-relative upload URLs
  types/               shared TS types mirroring the API contract
  utils/               pure helpers (tree assemble/search/findNodeById/completion-count, markdown-editing cursor helpers, ordinal date formatting, sessionStatus.ts's upcoming/in_progress/expired/logged state machine)
```

**A page's `?query=param` is the state, not local component state, wherever the page has a shareable "mode."** The Learning page's Active/Completed/Favs tab and search query, and the Statistics page's Week/Month/Year range, all live in the URL — `?range=month` is a real, shareable, back-button-friendly link. Adopt this convention for any future page-level toggle rather than local `useState`.

**AppLayout's shell is `flex flex-col md:flex-row`, not just `md:flex`.** The inner content container's `flex-1` (which bounds it to the remaining viewport height so its own `overflow-y-auto` can do the actual scrolling, independent of the sidebar) only takes effect when its parent is a flex container — `md:flex` alone meant the whole page was unscrollable below the `md` breakpoint. If this shell is ever restructured, keep the base `flex` unconditional.

**Search is page-local, not global chrome.** Only the Learning page has anything to search, so the search input lives there, not in `AppLayout`'s header (an earlier version put it in the shared header for every page — removed once it became clear it was inert everywhere but Learning).

**Notes editor is one shared dialog instance, not one per tree row.** `LearningTreePage` owns which item's notes are open (`notesItemId` state, resolved via `findNodeById`) and renders a single `NotesEditorDialog`; the per-row `NoteIndicator` is a thin trigger button. This is what lets the dialog's table-of-contents (for a root topic, auto-generated from its children) hand off to a different item's notes without any dialog-in-dialog nesting.

**Responsive is a first-class requirement starting Milestone 2**, not deferred polish — every page must be verified at phone (~375–430px), tablet (~768px), and laptop (~1280px+) widths before being considered done.

## 4. Database Schema (PostgreSQL)

UUID primary keys throughout (ADR-008). Soft deletes (`deleted_at`) on user-owned mutable tables (ADR-003). Every user-owned table carries `user_id` directly, even where derivable via a join — defense in depth (ADR-011).

### `users`

| Column         | Type          | Notes                                  |
|----------------|---------------|------------------------------------------|
| id             | UUID PK       | `gen_random_uuid()`                       |
| email          | TEXT UNIQUE   | NOT NULL                                  |
| password_hash  | TEXT          | NOT NULL (bcrypt)                         |
| display_name   | TEXT          | NOT NULL                                  |
| avatar_url     | TEXT          | nullable                                  |
| username       | TEXT          | nullable, unique (plain index — always lowercased on write, see ADR-027); no shareable profile link until set |
| bio            | TEXT          | nullable                                  |
| social_links   | JSONB         | NOT NULL DEFAULT `{}` — map of platform key → URL, keys restricted to `models.SocialPlatforms` (migration 000008) |
| is_public      | BOOLEAN       | NOT NULL DEFAULT true (ADR-027)           |
| created_at     | TIMESTAMPTZ   | NOT NULL DEFAULT now()                    |
| updated_at     | TIMESTAMPTZ   | NOT NULL DEFAULT now()                    |

### `refresh_tokens`

| Column       | Type        | Notes                                    |
|--------------|-------------|---------------------------------------------|
| id           | UUID PK     |                                               |
| user_id      | UUID FK     | → users.id                                   |
| token_hash   | TEXT        | NOT NULL — hash of the token, never plaintext|
| expires_at   | TIMESTAMPTZ | NOT NULL                                     |
| created_at   | TIMESTAMPTZ | NOT NULL DEFAULT now()                       |
| revoked_at   | TIMESTAMPTZ | nullable                                     |

Index: `(user_id)`, `(token_hash)`.

### `learning_items`

| Column        | Type        | Notes                                                              |
|---------------|-------------|-----------------------------------------------------------------------|
| id            | UUID PK     |                                                                         |
| user_id       | UUID FK     | → users.id, NOT NULL                                                   |
| parent_id     | UUID        | FK → learning_items.id, NULL = root. Must belong to the same user_id.  |
| title         | TEXT        | NOT NULL                                                               |
| description   | TEXT        | nullable                                                               |
| status        | TEXT        | NOT NULL DEFAULT 'not_started'; CHECK IN ('not_started','in_progress','completed') |
| deadline      | TIMESTAMPTZ | nullable                                                               |
| position      | INTEGER     | NOT NULL DEFAULT 0 — sibling ordering, future drag-reorder ready       |
| is_favorite   | BOOLEAN     | NOT NULL DEFAULT false — user-chosen, independent of status/position (migration 000007) |
| created_at    | TIMESTAMPTZ | NOT NULL DEFAULT now()                                                 |
| updated_at    | TIMESTAMPTZ | NOT NULL DEFAULT now()                                                 |
| completed_at  | TIMESTAMPTZ | nullable                                                               |
| deleted_at    | TIMESTAMPTZ | nullable — soft delete                                                 |

Indexes: `(user_id)`, `(user_id, parent_id)`, `(user_id, status)`, `(deleted_at)`, `(user_id, is_favorite)`.

### `study_sessions`

| Column            | Type        | Notes                                        |
|-------------------|-------------|-------------------------------------------------|
| id                | UUID PK     |                                                    |
| user_id           | UUID FK     | → users.id, NOT NULL (denormalized, ADR-011)      |
| learning_item_id  | UUID FK     | → learning_items.id, NOT NULL — the "primary" topic (first one chosen); kept for backward compatibility and simple single-topic queries. A session's full topic set lives in `study_session_topics` below. |
| hours             | REAL        | NOT NULL, CHECK (hours >= 0 AND hours <= 24) — relaxed from `> 0` (migration `000010`) so a pending scheduled session can legitimately be 0 until confirmed |
| notes             | TEXT        | nullable                                           |
| session_date      | DATE        | NOT NULL                                           |
| scheduled_start   | TIMESTAMPTZ | nullable (migration `000009`) — null for old-style retroactive logs; set for scheduled sessions and for retroactive logs that specify exact times |
| scheduled_end     | TIMESTAMPTZ | nullable (migration `000009`) — session is "pending" (awaiting honor-system confirmation) when this is set and `confirmed_at` is null |
| confirmed_at      | TIMESTAMPTZ | nullable (migration `000009`) — set when a scheduled session is confirmed complete, or immediately at creation for a retroactive log with exact times (logging after the fact means it already happened) |
| created_at        | TIMESTAMPTZ | NOT NULL DEFAULT now()                             |
| deleted_at        | TIMESTAMPTZ | nullable — soft delete                             |

Indexes: `(user_id)`, `(user_id, session_date)`, `(learning_item_id)`, `(user_id, scheduled_end, confirmed_at)` partial index where `scheduled_end IS NOT NULL`.

### `study_session_topics` (migration `000011`)

A session can cover more than one topic (e.g. two related subjects studied in one sitting). Many-to-many join table, always populated for every session going forward (including single-topic ones, so `TopTopics` queries can join through it uniformly) — existing rows were backfilled from their single `learning_item_id` at migration time.

| Column            | Type    | Notes                                    |
|-------------------|---------|----------------------------------------------|
| study_session_id  | UUID FK | → study_sessions.id, part of composite PK, ON DELETE CASCADE |
| learning_item_id  | UUID FK | → learning_items.id, part of composite PK, ON DELETE CASCADE |

Index: `(learning_item_id)`.

### `events` (append-only, not exposed via API — future AI hook)

| Column       | Type        | Notes                                                                 |
|--------------|-------------|---------------------------------------------------------------------------|
| id           | UUID PK     |                                                                             |
| user_id      | UUID FK     | → users.id, NOT NULL                                                       |
| event_type   | TEXT        | TASK_CREATED, TASK_COMPLETED, TASK_REOPENED, TASK_UPDATED, TASK_DELETED, ITEM_RENAMED, SESSION_ADDED, SESSION_DELETED |
| entity_type  | TEXT        | 'learning_item' \| 'study_session'                                         |
| entity_id    | UUID        |                                                                             |
| payload      | JSONB       | snapshot of relevant fields at event time                                  |
| created_at   | TIMESTAMPTZ | NOT NULL DEFAULT now()                                                      |

Indexes: `(user_id)`, `(entity_type, entity_id)`, `(event_type)`.

## 5. API Overview

Base path `/api/v1`. All routes except `auth/register`, `auth/login`, `auth/refresh` require `Authorization: Bearer <access_token>`.

| Method | Path                     | Auth | Purpose                                   |
|--------|--------------------------|------|--------------------------------------------|
| POST   | /auth/register            | none | create account, returns access token + sets refresh cookie |
| POST   | /auth/login                | none | authenticate, returns access token + sets refresh cookie |
| POST   | /auth/refresh               | cookie | rotate access token using refresh cookie |
| POST   | /auth/logout                | yes  | revoke refresh token, clear cookie        |
| GET    | /auth/me                    | yes  | current user                              |
| PUT    | /profile                    | yes  | update display_name / avatar_url / username / bio / social_links / is_public |
| PUT    | /profile/password            | yes  | change password                           |
| GET    | /profile/heatmap              | yes  | daily study hours, last 365 days (GitHub-graph-style) |
| GET    | /public/profiles/:username     | none | shareable profile (ADR-027) — 404 identically for nonexistent or private |
| GET    | /items                       | yes  | list caller's items (flat)                |
| POST   | /items                       | yes  | create item                                |
| PUT    | /items/:id                   | yes  | update title/description/deadline         |
| PATCH  | /items/:id/status             | yes  | mark complete / reopen                    |
| PATCH  | /items/:id/favorite            | yes  | toggle is_favorite (independent of status) |
| DELETE | /items/:id                    | yes  | soft-delete item + descendants + sessions |
| GET    | /sessions                     | yes  | list caller's sessions (filterable)       |
| POST   | /sessions                      | yes  | log a retroactive session (`session_date` given) or schedule a future one (`session_date` omitted, `scheduled_start`/`scheduled_end` given instead) — `learning_item_ids` is an array, one or more topics |
| POST   | /sessions/:id/confirm            | yes  | honor-system: confirm a scheduled session complete (only once `now >= scheduled_start`); optional hours/notes override |
| DELETE | /sessions/:id                  | yes  | delete a session                          |
| GET    | /dashboard                     | yes  | aggregate dashboard payload (stat cards + chart data for the Dashboard page) |
| GET    | /stats?range=week\|month\|year | yes  | chart data for the dedicated Statistics page |
| GET    | /items/trash                    | yes  | list soft-deleted "trash roots" (ADR-003); also lazily purges anything past the 7-day retention period (ADR-026) |
| DELETE | /items/trash                    | yes  | "Empty Trash" — hard-delete everything currently in the trash |
| POST   | /items/:id/restore               | yes  | undo a soft-delete, cascades like Delete   |
| DELETE | /items/:id/permanent              | yes  | hard-delete a single trash item + descendants, no recovery |
| POST   | /uploads                          | yes  | upload an image (for notes), returns a URL |
| GET    | /uploads/*filepath                | none | serves uploaded images (see ADR-022)       |
| GET    | /health                         | none | liveness/readiness check                  |

Full request/response field detail: see the Lead Engineer's plan messages (2026-07-06). Error shape: `{ "error": { "code", "message", "fields"? } }`.

## 6. Deployment Architecture

- **Backend**: Dockerized Go binary, deployable to any container host (Railway/Render/Fly.io recommended as low-friction defaults — see ADR-014). Config entirely via env vars (`DATABASE_URL`, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `PORT`).
- **Database**: managed PostgreSQL (Neon/Supabase/Railway Postgres — any works, it's just a connection string).
- **Frontend**: static Vite build served from Vercel/Netlify/Cloudflare Pages, or from the same domain as the backend behind a reverse proxy (avoids cross-site cookie complexity — see ADR-010).
- **Local dev parity**: `docker-compose.yml` runs Postgres + backend + frontend together, so dev never touches a different DB engine than production.
- HTTPS is mandatory in any deployed environment (required for secure cookies to function).

**Pilot topology (AWS free tier — ADR-021):** one small EC2 instance running `docker-compose` (backend container + Postgres container); frontend static build on S3+CloudFront or Vercel/Netlify. Nothing here is a different architecture from the provider-agnostic plan above — it's the same Docker image and the same Postgres connection string, just a concrete choice of "where" for the pilot. Moving to managed RDS or splitting the AI worker into its own container later is a config change, not a rewrite.

## 7. Phase 2 Architecture Readiness — AI Features (not MVP scope)

The user has flagged future phases adding AI: a Learning Generator, Task Breakdown, an "Explain Anything" feature, a Quiz Generator, and other ideas not yet finalized. **None of this is being built now** — the MVP stays AI-free per the original design document. What's below are load-bearing seams decided *now*, while the schema is still cheap to shape, specifically so four unrelated future features don't each invent their own ad-hoc pattern:

| Concern | Decision | Why now |
|---|---|---|
| Where LLM calls happen | Single `internal/services/ai/` package behind a provider-agnostic interface — no feature calls an LLM API directly | One place to swap providers, add retries/timeouts, and enforce usage limits (ADR-017) |
| Slow/long-running generation | Generic `ai_jobs` table (`user_id, job_type, status, input, output, error, timestamps`), claimed via `SELECT ... FOR UPDATE SKIP LOCKED` by a worker pool — not an in-memory queue | Crash-safe and safe across multiple backend replicas without adding Redis/SQS (ADR-018) |
| Per-user cost/usage | `ai_usage` table (`user_id, feature, tokens_in, tokens_out, estimated_cost, created_at`), queried the same `user_id`-scoped way as everything else | LLM calls cost money per call; need per-user visibility before it's needed for billing/limits (ADR-019) |
| Future semantic search / embeddings | Reserve Postgres's `pgvector` extension — no separate vector DB | Keeps embeddings next to the relational data they describe; avoids a second system later (ADR-020) |

None of these tables/packages exist yet and are **not** part of Milestones 1-6. They get built when the first AI feature is actually scoped and approved — this section exists so that work starts from an already-agreed foundation instead of a scramble.

## 8. Per-User Data Persistence — request-scoping flow

Every request that touches user data is scoped end to end, never by trusting client input:

1. Client sends `Authorization: Bearer <access_token>`.
2. `middleware/auth.go` verifies the JWT (signature + expiry). Invalid/missing → 401, request never reaches a handler. Valid → `user_id` (from the token's `sub` claim) is set on the Gin request context.
3. Handler reads `user_id` from context (never from the URL, query, or body) and passes it as an explicit argument to the service.
4. Service passes it down to the repository.
5. **Repository methods require `user_id` as a parameter on every call**, e.g. `GetByID(userID, itemID uuid.UUID)` runs `WHERE id = $1 AND user_id = $2` as one condition — never `WHERE id = $1` alone. A request for another user's ID returns zero rows → handler returns **404, not 403** (never confirm another user's resource exists).
6. On creates, `user_id` is stamped onto the new row from the authenticated context — it is never a field accepted in any request DTO.
7. `learning_items.parent_id` is additionally validated in the service layer to belong to the same `user_id` on create/move — a Postgres FK alone can't express "must belong to the same owner," so this is an application-level check.
8. Indexes (`user_id`, `user_id+status`, `user_id+parent_id`, `user_id+session_date`) keep every one of these scoped queries an index scan regardless of total rows across all hosted users.

## 9. Dashboarding — computed live, per user, on every request

`GET /dashboard` and `GET /stats` are authenticated endpoints; `dashboard_service.go` runs a handful of small `user_id`-scoped aggregate queries per request — no caching or materialized rollup table in the MVP (see ADR-015):

| Stat | Query shape |
|---|---|
| study_hours_this_week | `SUM(hours) FROM study_sessions WHERE user_id=$1 AND session_date >= date_trunc('week', now())` |
| completed / pending items | `SELECT status, COUNT(*) FROM learning_items WHERE user_id=$1 GROUP BY status` |
| completion_percentage | derived in the service layer from the counts above |
| current_streak | fetch distinct `session_date`s for the user, walk backward from today **in Go**, count the consecutive run (today not yet logged doesn't break it) — simpler to unit-test as a pure function than as recursive SQL |
| weekly_hours_chart / top_topics | `GROUP BY` aggregates joined to `learning_items` for titles, `user_id`-scoped |
| todays_sessions | `study_sessions WHERE user_id=$1 AND session_date = current_date` |
| recent_activity | derived from recent `learning_items`/`study_sessions` rows by `updated_at` — **not** read from the `events` table, which stays a write-only log reserved for future AI replay |

Rationale for no caching: each user's dataset is tiny (dozens–hundreds of rows even after months of use), so these are sub-millisecond indexed reads. Add caching only if real pilot usage shows otherwise.

**Client-side cache isolation:** the frontend's TanStack Query cache is process memory, not per-user. On logout (or a failed silent-refresh), the frontend calls `queryClient.clear()` before redirecting to `/login` — otherwise a second person logging into the same shared browser could briefly see the previous user's cached dashboard/tree data.

## 10. Note image uploads — local disk (ADR-022)

`POST /uploads` stores uploaded images on local disk under `<UPLOAD_DIR>/<user_id>/<uuid>.<ext>`, served back via an **unauthenticated** static route (`router.Static("/uploads", ...)`, registered outside the auth middleware group — `<img src>` tags don't carry an `Authorization` header). Validation: real byte-sniffing via `http.DetectContentType` against a whitelist (JPEG/PNG/GIF/WebP — SVG deliberately excluded, script-injection risk), a size cap enforced both via `http.MaxBytesReader` before parsing and again after, and a fully server-generated filename (never the client's). See ADR-022 for the full trade-off — **this is local disk, which does not survive a redeploy on an ephemeral-filesystem host; it must move to persistent object storage (e.g. S3-compatible) before any such production deploy.**

## 11. Major Design Changes

- **2026-07-06**: Scope changed from local single-user SQLite tool to hosted multi-user app with auth/profiles. Database engine changed SQLite → PostgreSQL. Added `users`, `refresh_tokens` tables and `user_id` scoping across all data tables. Added Deployment Agent and deployment milestone. Elevated responsive design to a Milestone-2 requirement. See ADR-007 through ADR-014 in `docs/DECISIONS.md`.
- **2026-07-06**: Clarified per-user request-scoping flow and dashboard computation strategy (sections 8-9 above) in response to a direct question. Changed cross-user access response from 403 to 404 (ADR-016). Documented no-caching rationale for dashboard stats (ADR-015) and added a mandatory `queryClient.clear()` on logout (client cache isolation between users on a shared device).
- **2026-07-06**: Phase 2 AI-readiness architecture (§7) and AWS pilot hosting topology (§6) added in response to a scalability question, ADR-017 through ADR-021 — no code, architecture placeholders only.
- **2026-07-06**: Milestone 1 (Backend Foundation + Auth) implemented, tested, and reviewed. Two review-driven fixes applied before sign-off: (1) `EventService.Record` now logs failures instead of silently discarding them — a swallowed audit-log write would quietly undermine the event table's whole purpose; (2) `handlers.RespondError` matches service errors via `errors.As` instead of a direct type assertion, for robustness against wrapped errors. Actual folder structure ended up with two packages not in the original plan: `internal/apperror` (typed service errors) and `internal/testutil` (real-Postgres test helper) — both are small, load-bearing, and consistent with the layering rules already established, not scope creep.
- **2026-07-07**: Post-Milestone-3 UX/feature pass, driven directly by the user testing the running app rather than by a new milestone plan. Added: a recycle bin (`GET /items/trash`, `POST /items/:id/restore`, mirroring Delete's cascade); a top-down org-chart view of the learning map (`OrgChartTree`/`OrgChartNode`) as an alternative to the indented list, toggled per-user preference, with an Active/Completed tab split on top-level topics; a full notes feature (markdown + toolbar + live preview, images uploaded from the device via the new local-disk-backed `/uploads` endpoint — ADR-022 — and an auto-generated table of contents for root topics that hands off between items' notes); a shareable Profile stat card exportable as a PNG. Removed the global search bar from `AppLayout` (dead chrome everywhere except Learning) in favor of a page-local one. None of this was scoped in the original Milestone 4-6 plan; it's UX polish requested directly against the running Milestone-3 build, applied without deferring to a formal milestone boundary since the user explicitly prioritized it over starting Milestone 4.
- **2026-07-07**: Study Sessions calendar completed end to end (day/week/month toggle, day-detail panel), plus a new concept not in the original design doc: scheduled sessions with honor-system completion (`scheduled_start`/`scheduled_end`/`confirmed_at` on `study_sessions`, migrations `000009`-`000010`) and multi-topic sessions (`study_session_topics` join table, migration `000011`) — a session can now cover more than one topic. Profile page redesigned to a two-column dashboard layout; public profile redesigned with a hero cover band. Fixed an app-wide scroll bug (the shell was `md:flex`, not unconditionally `flex`, so pages were unscrollable below the `md` breakpoint whenever content exceeded one viewport's height) and a CSS Grid track-sizing bug on Profile (an unwrappable long string forcing the grid wider than the viewport) — both are now documented patterns to watch for (see §3's callouts above).
- **2026-07-07**: Milestones 4 (Charts & Statistics) and 5 (Polish & Cross-Device QA) completed together per direct instruction. Dashboard landing page chart-ified in place (Weekly Hours, Top Topics, Completion %); new dedicated Statistics page (`/stats`) added with a Weekly/Monthly/Yearly toggle, backed by the `/stats` endpoint that had existed since Milestone 1 with no consumer or tests until now. `recharts` added as a new dependency. Cross-device QA substituted Playwright (driving the real dev server at phone/tablet/laptop widths) for physical-device testing, which isn't possible in this environment — this is the first time in the project browser automation has actually been used, closing a gap flagged since Milestone 2. Computed real WCAG contrast ratios rather than eyeballing them; found and fixed `--success`/`--warning` failing AA as text (added `--success-text`/`--warning-text`, darker steps of the same hue, for the handful of actual-text usages — icon fills unchanged). The project is not deployment-ready; only Milestone 6 remains.
