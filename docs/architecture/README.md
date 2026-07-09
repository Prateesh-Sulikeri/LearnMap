# Architecture reference index

This folder contains implementation-focused architecture documentation for the current LearnMap.app codebase.

Use these documents as the primary reference for understanding how the system is structured today, how layers interact, and where new work should fit.

## Documents

- [Backend architecture](backend/README.md) — Go, Gin, GORM, Postgres, repository/service/handler layering, auth, data tenancy, uploads, and testing
- [Frontend architecture](frontend/README.md) — React, TypeScript, Vite, routing, layouts, pages, service layer, shared components, and UX conventions

## Current architectural principles

- Frontend and backend are independently deployable services.
- The backend is the source of truth for identity, authorization, and ownership.
- Business logic lives in services; repositories only access data.
- Handlers remain thin and HTTP-focused.
- The UI uses a service layer rather than direct ad hoc API calls from components.
- User-owned data is scoped by user_id and protected with soft-delete semantics where appropriate.

## High-level system view

- Frontend: React + TypeScript + Vite SPA
- Backend: Go + Gin + GORM + Postgres
- Auth: JWT access token plus httpOnly refresh cookie
- Storage: relational database for core domain objects and local disk for uploaded images
- Deployment target: container-friendly, with a managed Postgres and a separate frontend host in production

## API contract reference

The backend API base path is /api/v1.

### Authentication and account

- POST /auth/register
  - body: { email, password, display_name, invite_code? }
  - response: { access_token, user }
- POST /auth/login
  - body: { email, password }
  - response: { access_token, user }
- POST /auth/refresh
  - uses the refresh cookie; response: { access_token }
- POST /auth/logout
  - requires auth; clears the refresh cookie
- GET /auth/me
  - requires auth; returns the current authenticated user

### Learning items

- GET /items
  - returns the current user's learning items
- POST /items
  - body: { title, description?, parent_id?, deadline? }
- PUT /items/:id
  - body: { title?, description?, deadline? }
- PATCH /items/:id/status
  - body: { status }
- PATCH /items/:id/favorite
  - body: { favorite }
- DELETE /items/:id
  - soft-deletes the item and descendants
- GET /items/trash
  - returns trash roots
- POST /items/:id/restore
  - restores a soft-deleted subtree
- DELETE /items/:id/permanent
  - hard-deletes a trash item subtree

### Study sessions

- GET /sessions
- POST /sessions
  - body: { learning_item_id, hours, notes?, session_date }
- DELETE /sessions/:id

### Profile, dashboard, and uploads

- PUT /profile
- PUT /profile/password
- GET /profile/heatmap
- GET /dashboard
- GET /stats?range=week|month|year
- GET /public/profiles/:username
- POST /uploads
- GET /uploads/*filepath

### Common conventions

- Authenticated routes require an Authorization header with a Bearer access token.
- Refresh-token rotation uses the httpOnly refresh cookie.
- Errors follow a consistent envelope: { error: { code, message, fields? } }.

## Database schema reference

The main database tables in the current backend are:

- users
  - id, email, password_hash, display_name, avatar_url, username, bio, social_links, is_public, created_at, updated_at
- refresh_tokens
  - id, user_id, token_hash, expires_at, created_at, revoked_at
- learning_items
  - id, user_id, parent_id, title, description, status, deadline, position, is_favorite, created_at, updated_at, completed_at, deleted_at
- study_sessions
  - id, user_id, learning_item_id, hours, notes, session_date, created_at, deleted_at
- events
  - id, user_id, event_type, entity_type, entity_id, payload, created_at

The current implementation uses UUID primary keys and soft-delete semantics on mutable user-owned data.

## Full project structure

### Backend

```text
backend/
  .air.toml                  - Air live-reload config for local Go development
  .env.example               - Example backend environment variables
  go.mod                     - Go module definition and dependencies
  go.sum                     - Go dependency checksums
  cmd/server/main.go         - Application entrypoint, wiring, and server startup
  internal/apperror/         - Typed application error definitions
  internal/config/config.go - Environment-driven configuration loader
  internal/database/connection.go - Database connection setup
  internal/handlers/         - HTTP handlers for auth, items, sessions, profile, uploads, health
  internal/middleware/       - Auth, CORS, logging, recovery, and rate limiting middleware
  internal/models/           - GORM domain models for users, items, sessions, events, and tokens
  internal/repositories/     - Database access layer for each domain
  internal/routes/routes.go - Route registration and middleware wiring
  internal/services/         - Business logic for auth, items, sessions, dashboard, profiles, uploads
  internal/testutil/         - Shared helpers for integration-style backend tests
  migrations/                - SQL migration files for schema evolution
  uploads/                   - Local storage directory for uploaded images
```

### Frontend

```text
frontend/
  .env.example               - Example frontend environment variables
  .env.local                 - Local frontend environment overrides
  .gitignore                 - Git ignore rules
  .oxlintrc.json             - Oxlint configuration
  components.json            - shadcn-style component configuration
  index.html                 - Vite HTML entrypoint
  package.json               - Frontend dependencies and scripts
  package-lock.json          - Locked frontend dependency tree
  public/                    - Static assets served by Vite
  README.md                  - Frontend setup notes
  src/App.tsx                - Top-level app router and route composition
  src/index.css              - Global Tailwind and app-wide CSS
  src/main.tsx               - Application bootstrap
  src/components/            - Reusable UI components and dialog primitives
  src/hooks/                 - Shared client-side hooks for auth and UI state
  src/layouts/               - Auth and app shell layouts
  src/lib/utils.ts           - Shared UI utility helpers
  src/pages/                 - Route-level screen components
  src/routes/ProtectedRoute.tsx - Route guard for authenticated pages
  src/services/              - API client and resource-specific service modules
  src/types/api.ts           - Shared frontend API types
  src/utils/                 - Helper utilities for dates, markdown, tree logic, URL handling, and more
  tsconfig*.json             - TypeScript project configuration files
  vite.config.ts            - Vite configuration
```

## Recommended use for AI agents

When making changes:

1. Start from the relevant architecture document.
2. Keep new logic in the correct layer.
3. Preserve the existing ownership and tenancy model.
4. Avoid bypassing the service/repository boundaries.
5. Prefer existing patterns over introducing new abstractions.
