# LearnMap.app — Architecture Decision Records

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

## ADR-021: Pilot hosting on AWS free tier — concrete topology

**Decision:** For the pilot, run the Dockerized backend and a containerized Postgres together on a single small EC2 instance (free-tier eligible), with the frontend static build on S3+CloudFront (or Vercel/Netlify — either is free and equally simple). This resolves ADR-014's previously-open "which provider" question for the pilot phase specifically.

**Context:** User offered AWS free tier as available pilot infrastructure.

**Alternatives considered:** Managed RDS Postgres from day one (safer for backups/HA, but costs more and isn't necessary until real, non-pilot usage); serverless (Lambda) backend (complicates the async job worker from ADR-018, which wants a long-running process, not a request-scoped function).

**Reasoning:** A single EC2 instance running `docker-compose` (backend + Postgres + the AI job worker as a goroutine pool inside the same backend binary) costs nothing on the free tier and requires zero architecture change from what's already planned — it's the same Docker image and the same Postgres connection string either way. Migrating the DB to managed RDS later, or splitting the worker into its own container/instance, is a config change, not a rewrite, because of ADR-002 (layering) and ADR-018 (DB-backed queue, not in-memory).

**Status:** Proposed (pending approval) — exact instance size/region left to the user at deployment time.
