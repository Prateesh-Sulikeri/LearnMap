# LearnMap.app — Architecture Decision Records

## ADR-030: Any item can be favorited; a favorited non-root item displays as its own pruned subtree

**Decision:** `SetFavorite` no longer rejects non-root items — any learning item, at any depth, can be favorited. The Favs tab collects every favorited node in the tree (via `collectFavoriteRoots`, a top-down walk that stops descending once it finds a favorited node) and displays each as its own independent entry: itself plus its own descendants, with its real ancestors and siblings excluded entirely. Favoriting a node with children no longer requires it to be a root topic. Separately, a completed root topic now drops out of both Active and Favs (still reachable in Completed) — reversing this project's own earlier choice to show every root in Active regardless of status.

**Context:** Direct feedback: favoriting was too restrictive (only root-level topics could be starred), and completed topics were cluttering both Active and Favs when the user wanted them to "graduate" to Completed only. Also asked to reorder the tabs to Favs/Active/Completed and make Favs the default landing tab.

**Alternatives considered:** Keeping favorites root-only and instead letting a user "promote" a sub-item to root level before favoriting it — rejected as extra friction for something that should just work directly on the item you're looking at. Clearing `is_favorite` server-side the moment an item completes — rejected in favor of a display-only filter: the flag stays true in the database, so reopening a completed+favorited item makes it reappear in Favs automatically, with no need to re-favorite it.

**Reasoning:** Collecting favorites as "stop descending once you find one" (rather than "find every favorited node regardless of nesting") avoids showing a favorited grandchild twice — once nested inside its already-favorited parent's subtree, once again as its own separate top-level entry. `TreeNode`'s and `OrgChartNode`'s "Add sub-item" action already existed unconditionally at every depth, so a favorited non-root node shown in Favs automatically supports adding children to it — no special-casing needed once the pruned-subtree rendering was in place.

**Status:** Approved and implemented (`SetFavorite` in `learning_item_service.go`; `collectFavoriteRoots` in `frontend/src/utils/tree.ts`; `LearningTreePage.tsx`'s tab computation; star button un-gated in `TreeNode.tsx`/`OrgChartNode.tsx`).

---

## ADR-029: `study_sessions.learning_item_id` kept as "primary," full topic set in a join table

**Decision:** A study session can cover more than one topic. Rather than replacing the existing `study_sessions.learning_item_id` column, added a new `study_session_topics` many-to-many join table (migration `000011`) holding the full topic set for every session — including single-topic ones, backfilled from their existing `learning_item_id` at migration time. `learning_item_id` stays as the "primary" (first-chosen) topic.

**Context:** Sessions originally had a single required topic. A direct request ("schedule a session for multiple topics") needed a real schema change, not just a UI tweak.

**Alternatives considered:** Making `learning_item_id` nullable and moving fully to the join table — rejected because it would require touching every existing query and the cascade-delete behavior on the primary column (deleting a learning item cascades to delete its sessions; losing that column would need reimplementing the cascade at the application layer). Storing a JSON/array column of topic IDs directly on `study_sessions` — rejected because it can't be indexed or joined the way a normal relational table can (the `TopTopics` aggregate query needs to join against `learning_items` per topic, not per session).

**Reasoning:** Keeping the legacy column means zero behavior change for every existing single-topic query and the existing cascade-delete-on-primary-topic semantics, while the join table is the source of truth for the full set going forward. `TopTopics` now joins through `study_session_topics` so a session's full hours attribute to *every* topic it covers (not split) — a 2-hour session spanning two topics counts as 2h toward each, a deliberate simplification consistent with how multi-topic sessions are presented everywhere else in the UI (comma-joined topic titles, no per-topic hour breakdown).

**Known limitation, accepted:** if a session's *primary* topic is deleted, the whole session cascades away via the existing FK on `learning_item_id` — even if the session still logically covers other, non-deleted topics. Fixing this fully would mean making `learning_item_id` nullable plus application-level reassignment logic; judged not worth the complexity for a pilot-scale edge case.

**Status:** Approved and implemented (migration `000011`; `models.StudySessionTopic`; `StudySessionRepository.AddTopics`/`TopicIDsForSessions`; `StudySessionService.validateTopics`; `TopicMultiSelect` component).

---

## ADR-028: Scheduled sessions confirm only once their window has started; a 5-minute grace window on "now"

**Decision:** A scheduled (honor-system) session can only be confirmed once `now >= scheduled_start` — not before, whether the session hasn't begun yet or has already ended. Enforced server-side (`StudySessionService.ConfirmScheduled`), not just in the UI. Separately, `CreateScheduled`'s "must be in the future" check tolerates `scheduled_start` being up to 5 minutes in the past (`scheduleGraceWindow`), both server-side and in the frontend's matching validation.

**Context:** Two direct bug reports in the same round: confirming a session before it had even started didn't make sense (the honor system means "did you do it," which presupposes the window has opened), and picking "start right now" when scheduling was effectively broken — by the time the request reached the server, the instant the user picked was already a few seconds or minutes in the past (`datetime-local` only has minute granularity, and filling out the rest of the form takes time), so a strict `> now` check on the backend rejected a legitimate, common choice.

**Alternatives considered:** Relying on frontend-only validation for the confirm-timing gate — rejected as insufficient; a direct API call could bypass client-side validation entirely (verified by testing a raw curl request, which succeeded before the server-side check was added). No grace window at all on scheduling — rejected because it makes "start now" unusable, which was the explicit ask.

**Reasoning:** 5 minutes was chosen as generous enough to absorb realistic form-fill time and clock skew without meaningfully weakening the "must be in the future" intent (a user attempting to schedule something clearly in the past, e.g. yesterday, is still correctly rejected).

**Status:** Approved and implemented (`StudySessionService.CreateScheduled`/`ConfirmScheduled`; `ScheduleSessionDialog`'s matching frontend validation; `utils/sessionStatus.ts`'s upcoming/in_progress/expired/logged state machine, which gates the Confirm button's visibility in the UI to match).

---

## ADR-027: Username-based public profiles, public-by-default with an opt-out toggle

**Decision:** Public profile sharing uses a user-chosen, unique username (`/u/<username>`), not the raw user ID. Profiles are public by default (`is_public = true` on creation) but can be toggled off in Profile settings. A user has no shareable link at all until they set a username — `IsPublic` defaults true independent of whether `Username` is set.

**Context:** Asked directly (AskUserQuestion) rather than assumed, since both the URL scheme and the privacy default are hard to change later without breaking links or surprising users. The user chose a vanity username over the plain ID (more shareable, matches the "post this on your resume/bio" intent) and public-by-default-with-opt-out over private-by-default-opt-in.

**Alternatives considered:** Raw user ID in the URL — simpler (no uniqueness/validation/schema work) but far less shareable, rejected in favor of a username. Private-by-default (opt-in) — safer default from a pure privacy standpoint, but explicitly not what was asked for.

**Reasoning:** Usernames are normalized to lowercase on write (`ProfileService.UpdateProfile`) so a single plain unique index suffices — no case-insensitive collation or functional index needed, and no case-confusion between `/u/Alice` and `/u/alice`. The public endpoint (`GET /public/profiles/:username`) returns `NotFound` identically for "doesn't exist" and "exists but private" (ADR-016's existing "don't distinguish the reasons" rule extended to this new case) so a private profile can't be distinguished from a nonexistent one by a stranger probing usernames.

**Status:** Approved and implemented (migration `000008`; `models.User`; `ProfileService.UpdateProfile`; `PublicProfileService`; `PublicProfileHandler`; frontend `PublicProfilePage.tsx`).

---

## ADR-026: Trash retention enforced lazily on read, not a scheduled job

**Decision:** Deleted items are permanently purged 7 days after deletion, checked and enforced inside `ListTrash` itself (on every call) rather than by a background job or cron.

**Context:** The design doc's Todo asked for automatic cleanup of trashed items after a week. This project has no job scheduler or background worker infrastructure at all.

**Alternatives considered:** A real scheduled job (e.g. a goroutine ticker in `main.go`, or an external cron hitting a purge endpoint) — deferred as unnecessary infrastructure for a pilot-scale MVP with no such infrastructure anywhere else; a client-side timer — rejected, since purging must happen server-side regardless of whether any client is open.

**Reasoning:** A user opening the Trash page is the one moment that matters for this feature (there's no other UI surface where trash age is user-visible), so enforcing the policy exactly there is sufficient and adds no new moving parts. The tradeoff — a user who never revisits Trash keeps expired items around harmlessly until they do — is acceptable at this scale and is called out explicitly as technical debt rather than hidden.

**Status:** Approved and implemented (`backend/internal/services/learning_item_service.go`: `PurgeExpiredTrash`, called from `ListTrash`).

---

## ADR-025: Image sizing via the standard markdown title attribute, not raw HTML

**Decision:** Note images can be sized (Small/Medium/Large/Original) by encoding the size into the image's standard CommonMark title slot — `![alt](url "size=medium")` — parsed back out by the preview's `img` component into a CSS class, never rendered as a literal `title` attribute.

**Context:** Adjustable image sizes were requested. The two "real" ways to do this in markdown are either a custom, non-standard sizing syntax (needs a custom remark plugin) or embedding raw `<img width="...">` HTML directly. This project deliberately does not enable raw HTML in notes (`rehype-raw` is not installed) specifically to keep user-authored notes safe from script injection — re-enabling it just for image sizing would reopen that surface for a minor cosmetic feature.

**Alternatives considered:** A custom remark plugin for non-standard sizing syntax — more powerful (true drag-handle resizing) but a materially bigger scope increase than the feature justified, and the user explicitly picked the lighter "simple preset buttons" option when asked. Enabling raw HTML with a sanitizer added back in — rejected for the same reason: disproportionate to the ask.

**Reasoning:** The title attribute is valid, standard CommonMark — no parser changes needed, and it degrades gracefully (a viewer that doesn't understand the `size=` convention just shows a harmless literal title tooltip... except this app's own preview strips it before render specifically to avoid that). Zero new security surface, zero new dependency for the sizing itself.

**Status:** Approved and implemented (`frontend/src/utils/markdownEditing.ts`: `setImageSize`; `frontend/src/components/notes/MarkdownPreview.tsx`).

---

## ADR-024: Focus mode renders through a portal, not the Dialog primitive

**Decision:** Notes focus mode renders as a plain `fixed inset-0` div via `createPortal` straight onto `document.body`, completely bypassing Base UI's `Dialog`/`DialogContent` (Popup) component that the normal (non-focus) notes editor still uses.

**Context:** Two earlier attempts to make focus mode genuinely fullscreen by overriding `DialogContent`'s own styling both failed in the actual browser: first a Tailwind class override (silently lost to a tailwind-merge "variant bucket" mismatch — `sm:max-w-sm` in the base classes lives in a different conflict-resolution group than an unprefixed override class), then an inline `style` object (should win on CSS specificity grounds alone, but still rendered constrained in practice — root cause not fully diagnosed without live devtools access).

**Alternatives considered:** A third attempt at further overriding the Dialog primitive's own positioning — rejected after two failures at exactly that; digging into Base UI's internals with devtools — not available in this environment.

**Reasoning:** Rather than continuing to fight a component's internal layout behavior a third time, sidestepping it entirely removes the whole class of failure: there's nothing left of Base UI's Dialog positioning for a portaled plain div to conflict with. `DialogHeader`/`DialogFooter` (confirmed, via reading their source, to be plain `<div>` wrappers with no Base UI Root/Context dependency) are still reused in both the portal and non-portal branches; `DialogTitle`/`DialogDescription` (which do wrap Base UI primitives requiring `Dialog` Root context) were replaced with plain `<p>` elements in the shared body so it renders correctly in both branches.

**Status:** Approved and implemented (`frontend/src/components/notes/NotesEditorDialog.tsx`).

---

## ADR-023: Dedicated test database, structurally enforced

**Decision:** Backend tests run against a separate `learnmap_test` database in the same Postgres instance, never the `learnmap` database the dev/prod backend actually uses. `internal/testutil.TestDatabaseURL()` defaults to `learnmap_test`; both `SetupTestDB` and `TruncateAll` now hard-refuse (return an error) if the target database's name doesn't contain "test", regardless of what `TEST_DATABASE_URL` is set to.

**Context:** A real incident, not a hypothetical: `TestDatabaseURL()` previously defaulted to the same `learnmap` database `docker-compose.yml`'s `postgres` service and the running backend container both use, and every `go test` run's `TruncateAll` (`TRUNCATE TABLE users, ... CASCADE`) was silently wiping whatever real data existed — confirmed by finding a live user's account gone and the `users` table containing only leftover test-fixture rows (literally `alice@example.com`/`bob@example.com` with a fake `password_hash = "hash"`) after a session of repeated test runs. The data lost this way is not recoverable — `TRUNCATE` isn't a soft delete and this local dev Postgres volume has no backup/snapshot.

**Alternatives considered:** Rely on documentation/convention alone (a comment saying "always use a separate test DB") — insufficient, since this is exactly what was already implicitly assumed and still failed in practice; a fully separate Postgres container just for tests — more isolation but more moving parts (another container to start/stop) for no additional safety over a same-instance separate database, since the actual risk is "wrong database name," not "wrong Postgres instance."

**Reasoning:** A structural guard (reject-by-name at the code level) is enforced regardless of what any future command, script, or CI config passes as `TEST_DATABASE_URL` — it doesn't rely on every future invocation getting a long connection string exactly right by eye, which is precisely the human/process failure that caused the incident. Requiring "test" in the name is a cheap, effective check: real dev/prod database names in this project never contain that substring, and it costs nothing for a genuinely dedicated test database to be named accordingly.

**Status:** Approved and implemented (`backend/internal/testutil/db.go`, `db_test.go`; `backend/README.md`; `.claude/agents/testing-agent.md`).

---

## ADR-001: Flat list + client-side tree assembly instead of recursive SQL

**Decision:** `GET /items` returns a flat array of all learning items with `parent_id`; the frontend assembles the tree in memory.

**Context:** `learning_items` is a self-referential, unlimited-depth hierarchy. Two implementation options: recursive CTE queries server-side, or flat fetch + client assembly.

**Alternatives considered:** SQLite recursive CTEs per subtree fetch; materialized path / nested-set model.

**Reasoning:** Single-user, local dataset — realistically dozens to low hundreds of items. A flat fetch is O(1) queries, trivially cacheable by TanStack Query, and the tree-assembly logic is a simple, testable pure function. Recursive CTEs or nested-set add real complexity for zero benefit at this scale.

**Status:** Proposed (pending approval).

---

## ADR-002: Layered backend (handlers / services / repositories)

**Decision:** Strict separation — handlers only parse HTTP and format responses, services hold all business logic, repositories are the only DB access point.

**Context:** Mandated by project CLAUDE.md ("Business logic belongs in services. Repositories only access the database. Handlers only handle HTTP.").

**Alternatives considered:** Fat-handler pattern (common in small Gin projects); active-record style directly on GORM models.

**Reasoning:** Even though this is a single-user MVP, the project is explicitly meant to be built "as if this will become a commercial SaaS." Layering costs little extra code at this scale and makes adding auth/multi-tenancy later a service-layer concern instead of a rewrite.

**Status:** Approved (per CLAUDE.md, non-negotiable).

---

## ADR-003: Soft delete on `learning_items` and `study_sessions`

**Decision:** Deletes set `deleted_at` rather than removing rows; cascade "delete" of a subtree soft-deletes all descendants and their sessions.

**Context:** Design doc requires delete confirmation but doesn't specify delete semantics. The `events` table (append-only, future-AI-facing) references entities by id — hard-deleting would leave dangling/unreconstructable history.

**Alternatives considered:** Hard delete with `ON DELETE CASCADE`.

**Reasoning:** Soft delete is reversible (cheap safety net for a destructive action performed via keyboard/misclick), and keeps event history meaningful — "replaying events" (design doc §15) is far less useful if referenced entities no longer exist. GORM has native soft-delete support (`gorm.DeletedAt`), so this adds negligible complexity.

**Status:** Proposed (pending approval) — flagged explicitly in the plan for user sign-off since the design doc doesn't specify this.

---

## ADR-004: Completion % = completed items / all items (flat, not leaf-only)

**Decision:** Dashboard "Completion %" and "Completed/Pending Items" counts are computed across every `learning_items` row regardless of depth (branch nodes and leaf nodes counted equally).

**Context:** Design doc shows nested hierarchy (e.g. Backend > Java > Collections) but doesn't specify whether completion stats count leaves only or all nodes.

**Alternatives considered:** Leaf-only completion (ignore branch/category nodes in the percentage).

**Reasoning:** Simplest, most predictable interpretation; avoids a "what counts as a leaf" edge case (a node can gain children later, changing its classification retroactively). Flagged as an assumption for user review.

**Status:** Proposed (pending approval).

---

## ADR-005: Streak = consecutive calendar days with ≥1 study session

**Decision:** "Current Streak" counts consecutive days, ending today or yesterday (a day not yet logged doesn't break the streak until it's fully elapsed), with at least one `study_sessions` row on that date.

**Context:** Design doc lists "Current Streak" as a dashboard stat without defining it.

**Alternatives considered:** Streak based on hours threshold per day; streak based on item completion instead of sessions.

**Reasoning:** Matches the Duolingo-style "show up daily" framing in the design philosophy (§3, §17) and is the simplest definition tied directly to the one action the app explicitly tracks (manual session logging).

**Status:** Proposed (pending approval).

---

## ADR-006: API versioned under `/api/v1`

**Decision:** All routes prefixed `/api/v1`.

**Context:** Design doc lists bare paths (`/items`, `/sessions`, `/dashboard`).

**Alternatives considered:** No prefix, matching the doc literally.

**Reasoning:** Zero-cost now, avoids a breaking change later if the API needs to evolve — counts as a "small engineering improvement that doesn't change product scope" per CLAUDE.md.

**Status:** Proposed (pending approval).

---

## ADR-007: PostgreSQL instead of SQLite

**Decision:** Backend uses PostgreSQL (via GORM's postgres driver), not SQLite.

**Context:** The user has directed that LearnMap.app be hosted and used concurrently from multiple devices (phone + laptop) by multiple pilot testers, and explicitly asked for the DB engine call to be made for them, flagging discomfort with SQLite given a possible future move to Postgres anyway.

**Alternatives considered:** Keep SQLite with WAL mode (works for one process, but most hosting platforms give ephemeral or non-trivially-shared disks, and multi-user concurrent writes are a worse fit); SQLite via a network layer like litestream/rqlite (adds operational complexity for no real benefit here).

**Reasoning:** A hosted, multi-user, multi-device app is exactly the scenario SQLite is the wrong tool for — it's a single-process embedded DB, not a client-server one. Postgres is the standard, well-supported choice for this shape of app, has mature managed hosting (Neon/Supabase/Railway), and GORM's driver swap is close to free since no code exists yet. Making this call now avoids the exact "change it to psql later" migration the user wanted to avoid.

**Status:** Approved (per explicit user delegation, 2026-07-06).

---

## ADR-008: UUID primary keys

**Decision:** Every table uses a UUID primary key, not an auto-incrementing integer.

**Context:** The app is now multi-user and hosted; sequential integer IDs make it trivial to enumerate/guess other users' resource IDs (e.g. `/items/43` → `/items/44`).

**Alternatives considered:** BIGSERIAL ints with authorization checks alone as the guard.

**Reasoning:** Authorization checks (user_id scoping) are the real defense and are mandatory regardless, but UUIDs remove enumeration as an attack surface entirely and are the conventional default for hosted multi-tenant systems. Marginal cost (slightly larger index size) is irrelevant at this scale.

**Status:** Proposed (pending approval).

---

## ADR-009: Versioned SQL migrations instead of GORM AutoMigrate

**Decision:** Schema changes ship as versioned up/down SQL migration files (golang-migrate or goose), run explicitly at deploy time. GORM `AutoMigrate` is not used against any shared/hosted database.

**Context:** Real user data now exists in a hosted database shared across pilot testers; schema drift or an unreviewed automatic migration is a much bigger risk than in a disposable local SQLite file.

**Alternatives considered:** GORM `AutoMigrate` on every boot (fine for the original local single-user tool, risky for hosted multi-user data).

**Reasoning:** Versioned migrations are reviewable, reversible, and safe to run in CI/CD before deploying new backend code — standard practice once real, shared data is on the line.

**Status:** Proposed (pending approval).

---

## ADR-010: JWT access token + httpOnly refresh cookie for auth

**Decision:** Login/register issue a short-lived JWT access token (returned in the JSON body, held in memory on the frontend, sent as `Authorization: Bearer`) and a longer-lived refresh token stored only as an httpOnly, Secure cookie (hashed at rest server-side, revocable via the `refresh_tokens` table).

**Context:** The app needs session persistence across a phone browser and a laptop browser for multiple real users, which is a materially higher security stake than the original local single-user tool.

**Alternatives considered:** Plain JWT in localStorage (simpler, but vulnerable to XSS-based token theft — a real concern once multiple real people's data is involved); server-side session store only (works, but a stateless access token is simpler to scale/host).

**Reasoning:** This hybrid is the standard, well-understood pattern for browser-based multi-device auth: XSS can't steal the httpOnly refresh cookie, and a stolen short-lived access token has a small blast-radius window. Requires HTTPS in production (cookies must be `Secure`) — already a requirement for a hosted app.

**Status:** Proposed (pending approval).

---

## ADR-011: `user_id` denormalized onto every user-owned table

**Decision:** `study_sessions` and `events` carry `user_id` directly, even though it's derivable via `learning_item_id`'s owner.

**Context:** Cross-user data leakage is the single worst failure mode for a multi-user pilot (one tester seeing another's private study data).

**Alternatives considered:** Derive ownership only via joins through `learning_items`.

**Reasoning:** Defense in depth — every repository query can filter `WHERE user_id = ?` directly without relying on a join being written correctly every single time. A missed join is a security bug; a missing direct filter is a much easier code-review catch (see code-review-agent's checklist).

**Status:** Proposed (pending approval).

---

## ADR-012: Responsive design is a Milestone-2 requirement, not Milestone-5 polish

**Decision:** Mobile/tablet/laptop breakpoints and touch-friendly targets are part of the acceptance bar starting with the frontend foundation milestone, not deferred to the final polish pass.

**Context:** Pilot testing will happen across multiple people and multiple screen sizes, including phones — the original doc treated "Responsive UI" as Milestone-5 polish, which assumed a single local desktop user.

**Alternatives considered:** Build desktop-first and retrofit responsiveness at the end (the original plan's approach).

**Reasoning:** Retrofitting responsive layout onto a desktop-first tree view / dashboard is materially more rework than designing mobile-first from the start, especially for the Learning Tree page (wide nested indentation doesn't work on a phone and needs a different interaction pattern, not just a CSS tweak).

**Status:** Proposed (pending approval).

---

## ADR-013: Registration gated by an invite code during pilot

**Decision:** `POST /auth/register` requires a shared invite code (checked against an env var), rejecting registration attempts without it.

**Context:** The app will be hosted and reachable at a real URL during pilot testing with a known, bounded set of people, not the general public.

**Alternatives considered:** Fully open registration (simplest, but exposes the pilot to random signups); per-user invite links (more robust, meaningfully more work for a short pilot).

**Reasoning:** A single shared invite code is a few lines of code and fully removes the "random internet user signs up" risk during pilot, without building a real invite system that isn't needed yet. Trivial to remove post-pilot.

**Status:** Proposed (pending approval).

---

## ADR-014: Deployment stack — containerized, provider-agnostic, with recommended defaults

**Decision:** Package the backend as a Docker image and the frontend as a static build; recommend (but don't hard-couple the code to) Railway/Render/Fly.io for the backend + managed Postgres, and Vercel/Netlify/Cloudflare Pages for the frontend.

**Context:** The user wants the app hosted and reachable from a phone and a laptop; no specific hosting provider was requested.

**Alternatives considered:** Committing to one specific provider's proprietary deployment format now.

**Reasoning:** A plain Docker image + a `DATABASE_URL` connection string is portable across nearly any host, so the architecture doesn't need to bet on a provider before the user has a chance to weigh in on cost/preference at the deployment milestone. Recommended defaults are chosen for low setup friction and generous free/cheap tiers appropriate for a pilot.

**Status:** Proposed (pending approval) — provider choice specifically flagged for user input before Milestone 6.

---

## ADR-015: Dashboard/stats computed live per request, no cache or materialized rollups

**Decision:** `GET /dashboard` and `GET /stats` run direct `user_id`-scoped aggregate SQL queries on every request. No Redis/in-memory cache layer, no precomputed rollup table.

**Context:** User asked how per-user dashboarding would be handled; this is the point where a "needs caching" assumption could otherwise creep in unnecessarily.

**Alternatives considered:** A `dashboard_stats` materialized/precomputed table updated on writes; a cache layer (Redis) in front of the aggregate queries.

**Reasoning:** Each user's dataset stays small (dozens to low hundreds of rows even after months of daily use), and every aggregate query is already indexed on `user_id`, so these are sub-millisecond reads at pilot scale. Caching adds invalidation complexity (every item/session mutation would need to bust the right cache keys) for a performance problem that doesn't exist yet. Revisit only if real usage proves otherwise.

**Status:** Proposed (pending approval).

---

## ADR-016: Cross-user resource access returns 404, not 403

**Decision:** When an authenticated user requests a resource ID that exists but belongs to a different user, the API returns 404 (not found), not 403 (forbidden).

**Context:** Originally the contract listed 403 for "authenticated but not the resource owner"; revisited when explaining the per-user isolation mechanism in detail.

**Alternatives considered:** 403 with a generic "forbidden" message.

**Reasoning:** A 403 confirms to the caller that the ID *exists* and belongs to someone else — a minor information leak in a multi-tenant system. Querying `WHERE id = ? AND user_id = ?` as a single condition naturally produces "0 rows" for both "doesn't exist" and "not yours," which is the safer, standard pattern — no extra code required, just consistent query shape.

**Status:** Proposed (pending approval).

---

## ADR-017: Dedicated AI integration seam (`internal/services/ai/`), provider-agnostic

**Decision:** Once any AI feature (Learning Generator, Task Breakdown, Explain Anything, Quiz Generator, etc.) is scoped and approved, it will call an LLM only through a single `internal/services/ai/` package that wraps the provider client behind a Go interface (e.g. `Generate(ctx, prompt, opts) (Result, error)`). No feature calls an LLM API directly from its own service.

**Context:** User confirmed multiple, not-yet-finalized future AI features are planned. None of the current plan accounts for where/how those would plug in.

**Alternatives considered:** Let each future feature call its LLM provider directly from its own service (faster to start, but duplicates retry/timeout/error-handling/logging logic four-plus times and hard-codes a specific provider into every feature).

**Reasoning:** A single seam means (a) swapping or A/B-testing LLM providers later touches one file, not every feature; (b) usage/cost tracking (ADR-019) and rate limiting can be enforced in exactly one place; (c) it can be added later with zero impact on the MVP's non-AI code, since nothing in Milestones 1-6 depends on it existing yet. Not implemented now — this ADR exists so the seam is designed correctly *when* the first AI feature is scoped, not retrofitted after four features already exist with divergent patterns.

**Status:** Proposed (architectural placeholder — no code until an AI feature is actually scoped and approved).

---

## ADR-018: Async AI jobs via a Postgres-backed queue, not an in-memory queue or new infra

**Decision:** Any AI operation too slow to run inline in a request (Learning Generator, Task Breakdown, Quiz Generator all plausibly take several seconds) will be modeled as a row in a generic `ai_jobs` table (`id, user_id, job_type, status, input JSONB, output JSONB, error, created_at, started_at, completed_at`), processed by a worker pool that claims pending rows with `SELECT ... FOR UPDATE SKIP LOCKED`. No Redis/SQS/Kafka introduced for this.

**Context:** "Not scalable" is the right worry if AI calls were to block a web request thread, or if job state lived only in one process's memory — that breaks the moment there's more than one backend instance, or the process restarts mid-job.

**Alternatives considered:** In-memory goroutine queue (loses jobs on crash/restart, and silently double-processes or drops jobs if the backend ever runs as more than one replica); a managed queue (SQS/Redis) now.

**Reasoning:** `FOR UPDATE SKIP LOCKED` against a plain Postgres table is a well-established, crash-safe, multi-instance-safe queue pattern that needs no new infrastructure — it scales from "one backend container" to "N backend containers" without a code change, because the database itself is the coordination point. A managed queue is a reasonable upgrade *if* job volume ever outgrows what Postgres can comfortably do (a threshold pilot usage won't come close to), and swapping it in later only touches the worker's polling loop, not job producers.

**Status:** Proposed (architectural placeholder — table/worker not built until an AI feature needs it).

---

## ADR-019: Per-user AI usage tracking, from the start of Phase 2

**Decision:** Every AI operation writes a row to an `ai_usage` table (`user_id, feature, tokens_in, tokens_out, estimated_cost, created_at`) tied to the `ai_jobs` row (or the direct call, for synchronous features). Rate limiting / quotas for AI endpoints will be enforced by querying this table (`SUM/COUNT ... WHERE user_id = ? AND created_at >= ?`), the same scoped-query pattern used everywhere else.

**Context:** Unlike the current MVP (fixed hosting cost regardless of usage), LLM calls cost real money per call. With multiple pilot testers, one person's heavy usage could disproportionately drive cost with no visibility.

**Alternatives considered:** No usage tracking (fine for a single trusted local user; not fine once cost scales with a group of people you don't fully control).

**Reasoning:** Cheap to add (one table, `user_id`-indexed like everything else) and is the prerequisite for any future per-user rate limit, plan/tier, or budget alert — all of which become necessary the moment AI features exist for multiple users.

**Status:** Proposed (architectural placeholder — not built until Phase 2 begins).

---

## ADR-020: PostgreSQL + pgvector reserved for future semantic search, no separate vector database

**Decision:** If a future feature (e.g. "Explain Anything" grounded in the user's own notes/history, or topic similarity/search) needs embeddings, use Postgres's `pgvector` extension rather than introducing a separate vector database (Pinecone, Weaviate, etc.).

**Context:** This is the direct answer to "I don't think this is scalable" as it applies to the DB choice specifically: Postgres was in fact the right call for an AI-adjacent future, not a constraint on it.

**Alternatives considered:** A dedicated vector DB alongside Postgres.

**Reasoning:** `pgvector` is a mature, widely-used Postgres extension — embeddings live next to the relational data they describe (no dual-write consistency problem, no second system to operate/pay for/back up). At pilot-to-early-growth scale it comfortably handles per-user semantic search. Not enabled now; noted so the DB choice isn't second-guessed later for a need it already covers.

**Status:** Proposed (architectural placeholder, not enabled until a feature needs it).

---

## ADR-022: Note images stored on local disk, served unauthenticated

**Decision:** `POST /uploads` writes uploaded images to local disk (`<UPLOAD_DIR>/<user_id>/<uuid>.<ext>`) and serves them back via `router.Static("/uploads", ...)`, registered outside the auth-middleware group.

**Context:** The user asked for notes to support images uploaded from the device (not just pasted URLs), and no object-storage infrastructure exists anywhere in this project yet.

**Alternatives considered:** Object storage (S3-compatible) from day one; requiring the static route to sit behind auth.

**Reasoning:** Local disk is the simplest thing that works today and needs zero new infrastructure/credentials for a pilot-stage app; the URL returned to the client is root-relative (`/uploads/...`), not baked with a domain, so switching the storage backend later doesn't require rewriting already-saved note text. The static route can't require auth because `<img src>` tags issued by the browser carry no `Authorization` header — the trade-off (anyone who obtains a URL can view that image; protected only by an unguessable UUID filename, not real access control) is accepted explicitly, the same trust model already used for the pilot's invite-code gate. **This must move to persistent object storage before any production deploy to a host without a persistent filesystem** — local disk does not survive a redeploy on most such platforms.

**Status:** Approved (pilot/MVP scope) — revisit before Milestone 6 deployment if the chosen host doesn't have a persistent volume.

---

## ADR-021: Pilot hosting on AWS free tier — concrete topology

**Decision:** For the pilot, run the Dockerized backend and a containerized Postgres together on a single small EC2 instance (free-tier eligible), with the frontend static build on S3+CloudFront (or Vercel/Netlify — either is free and equally simple). This resolves ADR-014's previously-open "which provider" question for the pilot phase specifically.

**Context:** User offered AWS free tier as available pilot infrastructure.

**Alternatives considered:** Managed RDS Postgres from day one (safer for backups/HA, but costs more and isn't necessary until real, non-pilot usage); serverless (Lambda) backend (complicates the async job worker from ADR-018, which wants a long-running process, not a request-scoped function).

**Reasoning:** A single EC2 instance running `docker-compose` (backend + Postgres + the AI job worker as a goroutine pool inside the same backend binary) costs nothing on the free tier and requires zero architecture change from what's already planned — it's the same Docker image and the same Postgres connection string either way. Migrating the DB to managed RDS later, or splitting the worker into its own container/instance, is a config change, not a rewrite, because of ADR-002 (layering) and ADR-018 (DB-backed queue, not in-memory).

**Status:** Proposed (pending approval) — exact instance size/region left to the user at deployment time.
