# LearnMap.app — Postman Collection

`LearnMap.postman_collection.json` covers every Milestone 1 endpoint: health, auth (register/login/refresh/logout), profile, learning items, study sessions, and dashboard/stats — plus a dedicated folder proving cross-user data isolation (Bob cannot read, rename, complete, or delete Alice's data).

## Import
Postman → **Import** → select `LearnMap.postman_collection.json`. No separate environment file needed — everything is a collection variable (Collection → Variables tab).

## Before running
1. Backend running and reachable (default `http://localhost:8080`) with Postgres up (`docker compose up -d postgres`).
2. Set the `invite_code` collection variable to match your backend's `INVITE_CODE` env var (defaults to `pilot2026`).

## Running
Run folders top-to-bottom, or use **Collection Runner** on the whole collection — it's safely re-runnable (each run registers Alice/Bob with a fresh unique email). State (tokens, item/session ids) flows automatically between requests via collection variables; nothing needs to be copied by hand.

Verified end to end with Newman (42 requests, 71 assertions, 0 failures) as of 2026-07-06.
