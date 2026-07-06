# LearnMap.app — Project Status

**Last updated:** 2026-07-06

## Current Milestone
Milestone 4 — Charts & Statistics (not started)

## Overall Completion
~50% of MVP (Milestones 1-3 of 6 complete).

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

## Features In Progress
None — Milestone 4 not yet started.

## Next Milestone
Milestone 4 — `/stats` wired into Recharts (weekly hours, monthly hours, top topics, completion %), animated, responsive.

## Known Issues
None blocking.

## Technical Debt
- Backend isn't containerized yet (Dockerfile) — deferred to Milestone 6.
- GORM's default query logging is verbose — should be turned down before deployment (Milestone 6).
- Test suite requires `go test ./... -p 1` (documented in `.claude/agents/testing-agent.md`).
- Frontend has no automated test suite yet (unit/component tests for tree assembly, form validation) — the design doc's roadmap doesn't call for one explicitly, but it's worth considering before Milestone 6.
- Milestones 2 and 3's UI were verified via clean typecheck/build/lint, a manual API-contract cross-check between frontend services and backend DTOs, and (for M2) real backend request logs proving a live register→me→dashboard flow succeeded — but not via independent browser-automation click-through in this pass (headless browser tooling wasn't set up; the user declined installing it for now). Recommend a manual spot-check of the full click-through flow (and responsive breakpoints) before Milestone 5's dedicated cross-device QA pass.

## Project Health
🟢 Green — Milestones 1-3 complete. No blockers for Milestone 4.
