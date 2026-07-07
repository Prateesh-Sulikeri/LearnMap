# Pending Changes — Study Sessions & Dashboard

**Status as of 2026-07-07:** Part of a combined Profile/Study Sessions/Dashboard request. The Profile section (heatmap, bio, socials, shareable public profiles) is **done and committed** (`fdf5d59`) — see `docs/SESSION_LOG.md`'s "Profile expansion (stage 1 of 3)" entry and `docs/DECISIONS.md` ADR-027. Everything below is **not started** except where noted.

This file exists so the next session can pick up cleanly without re-deriving context. Delete it once everything below is done and folded into the normal docs (PROJECT_STATUS/CHANGELOG/SESSION_LOG/ARCHITECTURE).

---

## Study Sessions

### 1. Filters on the table, default to last 1 week
Add filter controls (topic at least; consider date-range) above the session list. Default the visible range to the last 7 days rather than showing everything. Note: once item 2 below replaces the table with a calendar, "default to 1 week" most naturally maps to **defaulting the calendar's view to Week** rather than a literal date-range filter on a table — reconsider this item's shape once the calendar exists rather than building a table filter that's about to be replaced.

### 2. Replace the table with a Teams-style (day/week/month) calendar
**Superseded — the user explicitly chose the shadcn registry block instead of schedule-x.** Installed and added: `npx shadcn@latest add list-jonas/shadcn-ui-big-calendar/big-calendar` (a shadcn-registry wrapper around `react-big-calendar` + `moment`, zero Radix dependency — confirmed by reading its source, so it's safe alongside this project's Base UI setup). Added to `frontend/src/components/shadcn-big-calendar/shadcn-big-calendar.{ts,css}`.

**Done:** `StudySessionsPage.tsx` now renders `ShadcnBigCalendar` above the existing table (table intentionally left in place — "nothing else" was the explicit instruction for this pass), fed real events built from `sessions` (`title`, `start`, `end` derived from `session_date` + `hours`). Default `react-big-calendar` toolbar already provides the Month/Week/Day/Agenda toggle — no extra code needed for that part.

**Not done / still open:**
- No theming pass yet — it's using the shadcn-big-calendar block's own default CSS variables, not yet matched to this app's actual palette/tokens (warm yellow accent, radii, shadows). Revisit before calling this visually finished.
- Still shows the OLD table too (not replaced) — decide whether to keep both or drop the table once the calendar is trusted.
- Doesn't default to Week view (react-big-calendar defaults to Month) — "default to 1 week" from item 1 above is still unaddressed.
- `event-form` companion registry item (`list-jonas/shadcn-ui-big-calendar/event-form`) was deliberately NOT installed — it pulls in Radix-based `form`/`input`/`button`, which would need reconciling with this project's Base UI setup. Any create/edit-event dialog should be hand-built with this project's own `Dialog`/`Button`/`Input`, not that companion piece.
- schedule-x is no longer the plan; don't reintroduce it unless asked again.

### 3. Scheduling + honor-system completion
A **new concept**, distinct from the existing "log a session after the fact" flow: reserve a future time block for a topic, then confirm you actually did it once the time passes.

Backend groundwork needed (not started):
- Add nullable `scheduled_start TIMESTAMPTZ`, `scheduled_end TIMESTAMPTZ`, `confirmed_at TIMESTAMPTZ` to `study_sessions` (new migration `000009` — `000008` is the last one that exists, for the Profile fields). Existing simply-logged sessions (created via "Add Session" today) leave all three null — they're always shown as complete, no behavior change for them.
- A session is "scheduled/pending" when `scheduled_end` is set and `confirmed_at` is null. It's "expired, needs confirmation" when additionally `now() > scheduled_end`.
- New service method to create a scheduled session (topic + `scheduled_start` + `scheduled_end`, no `hours`/`session_date` required up front).
- New endpoint to confirm completion (honor system — the user just says "yes I did this"): sets `confirmed_at = now()` and derives `hours` from the scheduled duration (or lets the user adjust it at confirmation time — decide when building this).
- `StudySessionService`/`StudySessionHandler`/`routes.go` all need extending; `frontend/src/services/sessionsApi.ts` and `frontend/src/types/api.ts`'s `StudySession` type need the new fields.

Frontend (not started):
- Selecting/dragging a time slot in the calendar opens a dialog to schedule (topic + duration) — reuse the existing "Add Session" dialog pattern, extended for a start/end time instead of just an hours count.
- Expired, unconfirmed scheduled sessions render grayed-out on the calendar with a "Did you complete this?" action.

### 4. Day-detail side panel
Clicking a day on the calendar should show that day's sessions in a panel to the right (not just the calendar cell itself). Not started — depends on item 2 existing first.

---

## Dashboard

### 1. Adaptive recent-activity window
Current behavior (`buildRecentActivity` in `backend/internal/services/dashboard_service.go`): pulls from all items + today's sessions, sorts, caps at 10. Requested change: show **today's activity if there's a lot of it, otherwise expand to the past week** — the reasoning given was that the new session calendar (item 2 above) will make a long-lived activity log redundant, so there's no need to persist/show more than necessary.

**Interpretation (not confirmed with the user, reconsider if it seems off when building this):** this reads as a *display/query* change — adjust what `GetDashboard` fetches and returns for `recent_activity`, not a data-deletion/retention change to the underlying `events` table (that table is explicitly reserved for future AI-replay per `docs/ARCHITECTURE.md` — deleting rows there would conflict with that documented intent). A reasonable shape: compute today's activity count first; if it's above some threshold (pick something sensible, e.g. 10), show just today's; otherwise widen the query to the past 7 days.

**Explicit instruction from the user:** "No need to go ham with the tests, for now code it we can test it later **but make sure to log this properly at the end**" — i.e. this one can ship with lighter test coverage than usual project convention, but the *why* and *what changed* must be written up clearly in `docs/SESSION_LOG.md` / `docs/CHANGELOG.md` when it's done. Don't skip the docs step even though the tests step is explicitly relaxed.

---

## Already-completed context (for reference, not action items)

- Profile: heatmap (`GET /profile/heatmap`), bio/username/socials (`users.username/bio/social_links/is_public`, migration `000008`), public profiles at `/u/:username` (`PublicProfileService`/`PublicProfileHandler`). See ADR-027.
- Two decisions already confirmed with the user for the Profile section (not re-askable, already resolved): username-based share URLs (not raw ID), public-by-default with an opt-out toggle (not private-by-default opt-in).
- `react-icons` added as a dependency (brand logos only — lucide-react dropped those).
