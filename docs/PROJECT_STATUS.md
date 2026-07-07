# LearnMap.app — Project Status

**Last updated:** 2026-07-07 (Profile/Sessions/Dashboard expansion, stage 2 of 3 — Sessions/Dashboard — in progress)

## Current Milestone
Milestone 4 — Charts & Statistics (not started; a substantial UX/feature pass happened first — see below)

## Overall Completion
~50% of MVP (Milestones 1-3 of 6 complete), plus a significant unplanned UX/feature pass on top of Milestone 3 (see "Features Completed").

## Scope
Hosted, multi-user learning tracker with authentication and profiles, used from phones and laptops, pilot-tested by multiple people across multiple screen sizes.

## Features Completed
**Milestone 1 — Backend Foundation + Auth:** full REST API (auth, items, sessions, dashboard/stats), JWT + rotating refresh cookie auth, per-user data isolation enforced and tested, append-only event log.

**Milestone 2 — Frontend Foundation, Navigation & Auth UI:** Vite/React 19/TS + TailwindCSS v4 + shadcn/ui (design doc's tokens, light theme only), auth pages, `ProtectedRoute`, mobile-first `AppLayout` (sidebar/bottom-tab-bar, breadcrumb, search, floating add), Learning Tree page (client-side tree assembly, persisted expand/collapse).

**Milestone 3 — Study Sessions, Task Management & Profile:**
- Item CRUD on the tree: add sub-item, rename, mark complete/reopen (toggle via the status circle or the actions menu), delete with a confirmation dialog that explains cascade behavior when the item has children
- Study Sessions page (`/sessions`): table view (date/topic/hours/notes), "Add Session" dialog (topic select populated from the learning tree, hours, date, notes), delete with confirmation
- Profile page (`/profile`): edit display name/avatar URL (synced back into the nav sidebar immediately via a new `updateUser` on the auth context), change password
- Dashboard (`/dashboard`) wired to live `/dashboard` data: stat cards (study hours this week, streak, completed, pending), top topics, today's sessions, recent activity — charts themselves are Milestone 4
- Nav expanded to 4 items (Dashboard, Learning, Sessions, Profile) across both the sidebar and phone bottom-tab-bar

**Post-Milestone-3 UX/feature pass (2026-07-07)**, driven by direct user testing of the running app rather than a formal milestone:
- Recycle bin: `GET /items/trash` + `POST /items/:id/restore`, mirroring Delete's cascade; Trash page (`/trash`) with restore
- Learning page: top-down org-chart view (`OrgChartTree`) as an alternative to the indented list (per-user toggle, both fully editable), Active/Completed tabs split on top-level topics, page-local search (removed the old global search bar from `AppLayout` — it was dead everywhere but this page)
- Full notes feature: markdown + toolbar (bold/italic/headers/code/image) + live preview, in a large dialog; images upload from the device via a new `/uploads` endpoint (local disk — ADR-022); a root topic's notes auto-generate a table of contents from its sub-topics, each entry linking to that sub-topic's own notes
- Profile page: shareable stat card (streak, most-time topic, avatar) exportable as a PNG; ordinal joined-date wording ("Joined March 22nd 2026"); avatar now actually renders (profile card + sidebar) instead of being a write-only field
- Streak rank system (7 fire-themed tiers keyed off `current_streak`), badge on the Profile stat card, all-ranks reference dialog, rank shown in the sidebar
- Focus mode for notes: fullscreen (via a `createPortal`, bypassing the Dialog primitive entirely after two CSS-based attempts both failed in the browser), collapsible side tree of the whole topic, defaults to Preview

**Notes-system Todo pass (2026-07-07)**, working through `docs/Todo` (user-authored feature/bug list) end to end:
- Copy-code "Copied!" confirmation; markdown-help text hidden outside Write mode
- Save behavior fixed: saving while in focus mode now persists without exiting/closing (previously always closed); mark-complete/reopen and "add sub-item" now work from inside the notes editor (focus mode or not)
- Ctrl/Cmd+S saves (browser's own Save Page prevented); debounced auto-save after ~2.5s idle; any close path (Cancel, backdrop, Escape) saves first if there's unsaved work
- Hierarchical numbering ("1"/"1a"/"1a1"-style, alternating numeric/alpha per depth) shown as circular badges; **since pulled back to the focus-mode side tree only** (see the follow-up round below) — the collapsed side tree still shows a thin rail of just the badges instead of nothing
- Rich markdown: GFM (tables, task lists, strikethrough) via `remark-gfm`, syntax-highlighted code blocks via `rehype-highlight` with a small custom light-theme palette (not UI semantic colors, to avoid e.g. a number literal reading as an error); image size presets (Small/Medium/Large/Original) via the standard markdown title-attribute slot, no raw HTML
- Trash: "Empty Trash" (with confirmation) and per-item "delete permanently", plus a lazy 7-day retention sweep (hard-deletes anything past the retention window on the next `ListTrash` call — no job scheduler exists in this project, so read-time enforcement stands in for one)
- Functional breadcrumbs: every segment but the last is a real link; the Learning page's Active/Completed tab and search query moved from local state into URL search params so "Learning / Completed" is an actual shareable link, not just a label
- Markdown export: a single note as a `.md` download, or a whole topic (root + every descendant) as one combined `.md` "notebook" with a generated table of contents — scoped down from the original ask (PDF/DOCX/.zip) per an explicit user decision to keep this batch lightweight; no new heavy dependencies

Three items from the same Todo were explicitly scoped down or deferred after asking the user directly (all picked the lighter option): no interactive/WYSIWYG-editable preview (checkboxes/tables/images stay read-only in Preview — reversing this was declined, keeping the original "markdown + toolbar, not WYSIWYG" decision intact); no PDF/DOCX/.zip export; no raw-HTML/drag-handle image resizing. Drag-and-drop reordering of tree items (also mentioned in the same Todo) was deferred without asking, as a separate, larger feature (needs a DnD library + a new backend endpoint to persist reordered `position`/`parent_id`).

**Follow-up fixes (2026-07-07)**, direct feedback on the round above:
- Fixed a real (if brief) bug: "Empty Trash"/permanent-delete appeared not to work — actually a stale backend container that hadn't been restarted since those routes were added (`go run` doesn't hot-reload). No code was broken; restarting fixed it immediately, confirmed via live `curl` before and after.
- Numbering badges removed from the list and org-chart tree views — now shown only in the notes focus-mode side tree, per direct instruction.
- `NumberBadge` now grows into a pill for longer labels instead of a fixed-size circle that clipped them.
- Notes-editor header actions consolidated into a single "..." dropdown (was 4 unlabeled icon buttons, including the previously-invisible export option) — the same discoverability fix already applied once this session to the tree row's actions menu.
- Added a clear (X) button to the Learning page search input.
- Learning page tabs redesigned: Active now shows every item regardless of status (previously excluded completed ones); Completed unchanged; new Favs tab — backed by a new `is_favorite` column, migration, and `PATCH /items/:id/favorite` endpoint. **Corrected after direct feedback**: Favs is a root-level filter exactly like Completed (a favorited top-level topic shows with its entire subtree and the full List/Map toggle), not a separate flat any-depth list — only top-level topics can be favorited at all, enforced server-side.

**Profile/Sessions/Dashboard expansion (2026-07-07):**
- **Stage 1 (Profile) — DONE:**
  - GitHub-contribution-graph-style heatmap (`ContributionHeatmap`, custom-built, no new dependency) on the Profile page, backed by a new `GET /profile/heatmap` endpoint (365 days of daily study hours, reusing the existing `DailyHoursSince` repository query)
  - Bio, a chosen username, and six social links (LinkedIn/GitHub/Instagram/X/LeetCode/portfolio) added to the profile — `react-icons` added as a new dependency specifically for brand logos, since lucide-react dropped all brand/logo icons in a past version
  - Shareable public profiles at `/u/:username` (ADR-027): public by default, an opt-out toggle in Profile settings, no auth required to view. Shows avatar/name/bio/socials/streak-rank/heatmap only — never learning-item content, which stays private. A private or nonexistent username returns the identical 404 (ADR-016's existing "don't distinguish the reasons" rule)
  - New `users` columns: `username` (nullable, unique, lowercased on write), `bio`, `social_links` (JSONB), `is_public` (migration `000008`)

- **Stage 2 (Sessions/Dashboard) — IN PROGRESS:**
  - Study Sessions: calendar now defaults to Week view (not Month); removed duplicate table below calendar
  - Scheduled sessions (honor-system completion):
    - Backend: migration 000009 adds scheduled_start, scheduled_end, confirmed_at to study_sessions; CreateScheduled() service reserves future blocks, ConfirmScheduled() marks complete
    - Frontend: ScheduleSessionDialog component for selecting topic + start/end times; ConfirmSessionDialog for confirming with optional hours/notes; both wired into StudySessionsPage
    - API: flexible POST /sessions for both retroactive and scheduled sessions; new POST /sessions/:id/confirm for completion
  - Dashboard: adaptive recent-activity window — shows today's activity if >= 10 items, otherwise expands to past 7 days
  - **Still TODO:** calendar drag-to-schedule, day-detail side panel, styling for expired sessions, comprehensive testing

## Features In Progress
- Study Sessions: Calendar drag-to-schedule, day-detail side panel (clicking day shows sessions in right panel), visual styling for expired scheduled sessions (grayed-out with "Did you complete?" action)
- Milestone 4 (Charts & Statistics): not yet started

## Next Milestone
Milestone 4 — `/stats` wired into Recharts (weekly hours, monthly hours, top topics, completion %), animated, responsive.

## Known Issues
- **Resolved 2026-07-07, but caused real data loss beforehand:** the test suite was silently truncating the live dev database on every run (see ADR-023). A user's account and all its data were wiped as a result. Test/dev database isolation is now structurally enforced — see `docs/DECISIONS.md` ADR-023 — but the specific data lost before the fix is unrecoverable; the account needs to be recreated.

## Technical Debt
- Backend isn't containerized yet (Dockerfile) — deferred to Milestone 6.
- GORM's default query logging is verbose — should be turned down before deployment (Milestone 6).
- Test suite requires `go test ./... -p 1` (documented in `.claude/agents/testing-agent.md`).
- Frontend has no automated test suite yet (unit/component tests for tree assembly, form validation) — the design doc's roadmap doesn't call for one explicitly, but it's worth considering before Milestone 6.
- Trash retention (auto-purge after 7 days) is enforced lazily on the next `ListTrash` call, not a scheduled background job — there's no job scheduler in this project yet. A user who never re-opens the Trash page keeps expired items around indefinitely (harmlessly, just not purged) until they do.
- Markdown export's table-of-contents anchor links use a GitHub-style auto-slug guess; not every markdown renderer slugs headings identically, so TOC links may not jump correctly in all viewers (the exported content itself is unaffected).
- The notes editor's new pure logic (hierarchical numbering, the image-size text rewrite, markdown export) has no dedicated frontend test coverage — same gap as the point above, not a new one.
- Public profile route (`GET /public/profiles/:username`) is rate-limited (30/15min) but otherwise has no bot/scraper defense (no CAPTCHA, no robots.txt directive) — acceptable at pilot scale, worth revisiting before any real public launch.
- No username availability check as the user types — they only find out it's taken on Save. A live-check endpoint would be a nice follow-up, not implemented now.
- **Note image uploads are stored on local disk** (`/uploads`, ADR-022) — must move to persistent object storage before any deploy to a host without a persistent filesystem. The static serving route is also intentionally unauthenticated (browsers don't send auth headers on `<img>` requests); protected only by unguessable filenames, not real access control.
- The post-M3 UX pass above was verified via clean backend build/vet/test (including new Go tests), clean frontend build/lint, and full Postman/Newman regression (including live curl end-to-end proof of the upload endpoint) — but not via independent browser-automation click-through (same tooling gap as M2/M3). The notes editor's cursor-insertion mechanics and the notes dialog's internal scroll behavior with a genuinely long note are the two areas most worth a manual click-test before calling this pass fully done.
- Milestones 2 and 3's UI were verified via clean typecheck/build/lint, a manual API-contract cross-check between frontend services and backend DTOs, and (for M2) real backend request logs proving a live register→me→dashboard flow succeeded — but not via independent browser-automation click-through in this pass (headless browser tooling wasn't set up; the user declined installing it for now). Recommend a manual spot-check of the full click-through flow (and responsive breakpoints) before Milestone 5's dedicated cross-device QA pass.

## Project Health
🟢 Green — Milestones 1-3 complete plus a substantial UX pass. No blockers for Milestone 4.
