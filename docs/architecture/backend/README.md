# Backend architecture reference

This document describes the current backend implementation in the repository, not a conceptual ideal. It is intended to be a practical reference for engineers and AI agents working on the codebase.

## 1. Purpose and runtime

The backend is the authoritative layer for:

- authentication and session management
- user-scoped data access
- business rules for learning items, study sessions, dashboards, profiles, and uploads
- persistence and migration management

The current implementation uses:

- Go
- Gin as the HTTP framework
- GORM as the ORM
- PostgreSQL as the database
- SQL migrations stored under the migrations folder
- local filesystem upload storage for image attachments

## 2. Current folder structure

The backend currently follows this structure:

```text
backend/
  cmd/
    server/
      main.go
  internal/
    apperror/
    config/
    database/
    handlers/
    middleware/
    models/
    repositories/
    routes/
    services/
    testutil/
  migrations/
  uploads/
```

The server entry point is [backend/cmd/server/main.go](../../backend/cmd/server/main.go).

## 3. API contract reference

The backend API is mounted under /api/v1 and is implemented in the handlers and routes packages.

### Core endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /auth/register | none | create an account and issue tokens |
| POST | /auth/login | none | authenticate and issue tokens |
| POST | /auth/refresh | cookie | rotate the access token |
| POST | /auth/logout | yes | revoke the refresh token |
| GET | /auth/me | yes | return the current authenticated user |
| GET | /items | yes | list the user's learning items |
| POST | /items | yes | create a learning item |
| PUT | /items/:id | yes | update a learning item |
| PATCH | /items/:id/status | yes | update item status |
| PATCH | /items/:id/favorite | yes | toggle favorite state |
| DELETE | /items/:id | yes | soft-delete an item subtree |
| GET | /sessions | yes | list sessions |
| POST | /sessions | yes | create a study session |
| DELETE | /sessions/:id | yes | delete a session |
| GET | /dashboard | yes | return dashboard aggregates |
| GET | /stats | yes | return chart data |
| GET | /profile/heatmap | yes | return heatmap-style stats |
| GET | /public/profiles/:username | none | return public profile data |
| POST | /uploads | yes | upload an image |
| GET | /uploads/*filepath | none | serve uploaded files |

### Request and response conventions

- Successful responses are ordinary JSON objects or arrays.
- Errors use the envelope { error: { code, message, fields? } }.
- Protected routes require Authorization: Bearer <access_token>.
- Refresh-token rotation depends on the httpOnly refresh cookie.

### Representative payloads

- Register: { email, password, display_name, invite_code? }
- Create item: { title, description?, parent_id?, deadline? }
- Create session: { learning_item_id, hours, notes?, session_date }
- Update profile: { display_name?, username?, bio?, avatar_url?, social_links?, is_public? }

## 4. Database schema reference

The persistent schema is centered around these tables:

- users
  - id (UUID), email (unique), password_hash, display_name, avatar_url, username, bio, social_links, is_public, created_at, updated_at
- refresh_tokens
  - id (UUID), user_id, token_hash, expires_at, created_at, revoked_at
- learning_items
  - id (UUID), user_id, parent_id, title, description, status, deadline, position, is_favorite, created_at, updated_at, completed_at, deleted_at
- study_sessions
  - id (UUID), user_id, learning_item_id, hours, notes, session_date, created_at, deleted_at
- events
  - id (UUID), user_id, event_type, entity_type, entity_id, payload, created_at

The schema is designed for multi-user tenancy, UUID-based identity, and soft-delete behavior for mutable user-owned records.

## 5. Entry point and bootstrap flow

Bootstrap order:

1. Load environment configuration.
2. Run database migrations.
3. Ensure the upload directory exists.
4. Open a database connection.
5. Construct repositories.
6. Construct services.
7. Construct handlers.
8. Register routes and start the Gin server.

This bootstrap pattern keeps construction logic centralized and makes dependency injection explicit.

## 6. Full backend file structure

```text
backend/
  .air.toml
  .env.example
  cmd/server/main.go
  go.mod
  go.sum
  internal/apperror/apperror.go
  internal/config/config.go
  internal/database/connection.go
  internal/handlers/auth_handler.go
  internal/handlers/auth_test.go
  internal/handlers/dashboard_handler.go
  internal/handlers/dashboard_test.go
  internal/handlers/health_handler.go
  internal/handlers/isolation_test.go
  internal/handlers/learning_item_handler.go
  internal/handlers/profile_handler.go
  internal/handlers/public_profile_handler.go
  internal/handlers/response.go
  internal/handlers/study_session_handler.go
  internal/handlers/testserver_test.go
  internal/handlers/upload_handler.go
  internal/handlers/upload_test.go
  internal/middleware/auth.go
  internal/middleware/cors.go
  internal/middleware/rate_limit.go
  internal/middleware/recovery.go
  internal/models/event.go
  internal/models/learning_item.go
  internal/models/refresh_token.go
  internal/models/study_session.go
  internal/models/user.go
  internal/repositories/event_repository.go
  internal/repositories/learning_item_repository.go
  internal/repositories/refresh_token_repository.go
  internal/repositories/study_session_repository.go
  internal/repositories/user_repository.go
  internal/routes/routes.go
  internal/services/auth_service.go
  internal/services/dashboard_service.go
  internal/services/dashboard_service_internal_test.go
  internal/services/event_service.go
  internal/services/learning_item_service.go
  internal/services/learning_item_service_test.go
  internal/services/profile_service.go
  internal/services/profile_service_test.go
  internal/services/public_profile_service.go
  internal/services/public_profile_service_test.go
  internal/services/study_session_service.go
  internal/services/upload_service.go
  internal/testutil/testutil.go
  migrations/000001_enable_pgcrypto.up.sql
  migrations/000001_enable_pgcrypto.down.sql
  migrations/000002_create_users.up.sql
  migrations/000002_create_users.down.sql
  migrations/000003_create_refresh_tokens.up.sql
  migrations/000003_create_refresh_tokens.down.sql
  migrations/000004_create_learning_items.up.sql
  migrations/000004_create_learning_items.down.sql
  migrations/000005_create_study_sessions.up.sql
  migrations/000005_create_study_sessions.down.sql
  migrations/000006_create_events.up.sql
  migrations/000006_create_events.down.sql
  migrations/000007_add_learning_items_favorite.up.sql
  migrations/000007_add_learning_items_favorite.down.sql
  migrations/000008_add_user_profile_fields.up.sql
  migrations/000008_add_user_profile_fields.down.sql
  uploads/
```

## 7. Layered architecture

The backend follows a layered structure with strict ownership boundaries.

### 3.1 Handlers

Location: [backend/internal/handlers](../../backend/internal/handlers)

Responsibilities:

- Parse incoming HTTP requests
- Validate request shape at the transport boundary
- Call a service
- Translate service results into JSON responses
- Convert domain errors into a consistent error envelope

Handlers should not contain business rules, ORM logic, or direct database queries.

### 3.2 Services

Location: [backend/internal/services](../../backend/internal/services)

Responsibilities:

- Implement core business logic
- Enforce domain rules
- Coordinate multiple repositories when needed
- Emit events for important state changes
- Apply tenant-aware rules for the current user

Examples:

- Auth service: registration, login, refresh, logout, JWT verification
- Learning item service: hierarchy validation, status transitions, soft-delete, restore, trash retention
- Study session service: session lifecycle and association rules
- Dashboard service: aggregate metrics
- Upload service: upload validation and file storage coordination

### 3.3 Repositories

Location: [backend/internal/repositories](../../backend/internal/repositories)

Responsibilities:

- Execute queries against the database
- Map rows into models
- Keep query logic close to the database concern
- Enforce user scope where appropriate

Repositories do not implement business rules. They should not decide whether a status transition is valid or whether a parent item exists.

### 3.4 Models

Location: [backend/internal/models](../../backend/internal/models)

Responsibilities:

- Define the database-backed domain objects
- Represent schema and relationships
- Provide the shared shape used by repositories, services, and handlers

Core models include:

- User
- RefreshToken
- LearningItem
- StudySession
- Event

### 3.5 Middleware

Location: [backend/internal/middleware](../../backend/internal/middleware)

Responsibilities:

- Authentication
- CORS handling
- rate limiting
- panic recovery
- request logging

Authentication middleware attaches the current user to request context and rejects invalid access tokens.

## 4. Routing and request flow

Routes are registered in [backend/internal/routes/routes.go](../../backend/internal/routes/routes.go).

The routing structure is intentionally split into:

- public routes for auth, public profile lookup, and health checks
- protected routes that require a valid bearer access token

The protected group is wrapped with auth middleware, so user identity is available throughout the request lifecycle.

Typical request flow:

1. Router receives an HTTP request.
2. Middleware runs first, including auth and CORS handling where appropriate.
3. Handler parses the request and forwards it to the service layer.
4. Service calls the relevant repository.
5. Repository executes database operations.
6. Service returns domain data or errors.
7. Handler formats the response.

## 5. Authentication model

Authentication is implemented with a two-token approach:

- Access token: short-lived JWT sent in the Authorization header
- Refresh token: long-lived opaque token stored as a hash, sent as an httpOnly cookie

The important behavior is:

- access tokens are used for API authorization
- refresh tokens are rotated on use
- refresh tokens are stored only as hashes and never exposed in plaintext
- logout revokes the current refresh token for the authenticated user

The auth service is the authoritative implementation for token issuance, verification, and refresh logic.

## 6. Data ownership and tenancy

A key architectural requirement in this project is that data is owned by a user and must be scoped accordingly.

The current implementation enforces this in several ways:

- every user-owned table includes a user_id column
- repository methods are written to require a user scope
- handlers do not receive raw user input as a substitute for auth context
- cross-user isolation is validated in tests

This is especially important for learning items, study sessions, refresh tokens, and events.

## 7. Core domain behavior

### 7.1 Learning items

Learning items are the central domain object. Their behavior includes:

- parent-child hierarchy
- status transitions between not_started, in_progress, and completed
- soft-delete for item deletion
- cascade soft-delete for descendants and related sessions
- favorite state for top-level topics
- trash retention and permanent deletion behavior

The business logic for this domain is concentrated in the learning item service rather than in the handler or repository layer.

### 7.2 Study sessions

Study sessions represent logged study time tied to a learning item.

Behavior includes:

- creation tied to a valid learning item
- soft-delete when the parent item is deleted
- user scoping
- listing and filtering by the authenticated user

### 7.3 Events

An append-only event system exists for important domain changes.

Events are emitted for actions such as:

- task creation
- task completion
- task reopen
- task rename
- task update
- task deletion
- session creation and deletion

The event service is intentionally separate from the main CRUD logic so future AI features can consume it without forcing new ad hoc patterns into the current domain code.

### 7.4 Uploads

Uploads are handled by the upload service and routed through the upload handler.

Important mechanics:

- files are stored on disk under the configured upload directory
- the server serves uploaded files through a static route
- filenames are UUID-based to avoid predictable paths
- uploads are treated as a user-facing asset rather than a core database entity

## 8. Error handling and response conventions

The backend uses typed application errors from [backend/internal/apperror](../../backend/internal/apperror).

The common pattern is:

- service returns an application error or domain object
- handler translates that into an HTTP response
- the response shape remains consistent for clients and tests

This reduces ad hoc error handling and makes client behavior more predictable.

## 9. Persistence and migrations

Database schema changes are handled through SQL migration files under [backend/migrations](../../backend/migrations).

The current server boot sequence applies migrations automatically before serving traffic.

This keeps local development and deployment closer to the same database lifecycle.

## 10. Testing strategy

The backend tests use real Postgres rather than mock-heavy unit tests.

Important points:

- tests run against a dedicated test database
- data isolation is verified explicitly
- route and handler behavior is exercised end to end where practical
- the current repository favors integration-style tests over isolated mock assertions

## 11. Practical conventions for future changes

When extending this backend, follow these rules:

- Put business logic in services.
- Keep repositories focused on persistence.
- Keep handlers thin.
- Add user scope to all user-owned data access.
- Prefer explicit errors over silent fallback behavior.
- Preserve the existing auth and tenancy model.
- Add tests for behavior that touches data ownership, auth, or deletion semantics.

## 12. Suggested mental model for the codebase

A useful way to think about the backend is:

- routes decide what URL and HTTP method belong to what feature
- handlers decide how to translate the request into a service call
- services decide what the feature means
- repositories decide how to store and retrieve the underlying data

That separation is one of the most important architectural traits of the current implementation.
