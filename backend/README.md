# LearnMap.app backend

Go + Gin + GORM + Postgres. No local Go install is assumed — everything
below runs through Docker.

## Prerequisites

- Docker Desktop running.

## 1. Start Postgres

From the repo root:

```bash
docker compose up -d postgres
```

Wait until it's healthy:

```bash
docker inspect learnmapapp-postgres-1 --format '{{.State.Health.Status}}'
```

## 2. Start the backend

There's no backend Dockerfile yet — dev runs a plain `golang:latest`
container with this directory bind-mounted, so edits on the host take
effect on the next restart (no hot-reload; restart the container after
changing code). Run from the repo root:

```bash
docker run -d --name learnmap-backend --network learnmapapp_default \
  -p 8080:8080 \
  -v "$(pwd)/backend:/app" \
  -w /app \
  -e DATABASE_URL="postgres://learnmap:learnmap_dev_password@postgres:5432/learnmap?sslmode=disable" \
  -e JWT_SECRET="dev-only-secret-not-for-production-please-change" \
  -e INVITE_CODE="pilot2026" \
  -e CORS_ALLOWED_ORIGINS="http://localhost:5173" \
  -e REFRESH_COOKIE_SECURE="false" \
  golang:latest sh -c "go run ./cmd/server"
```

(On Windows Git Bash, prefix with `MSYS_NO_PATHCONV=1` so the `-v` path
and `/app` argument aren't mangled, and use the full Windows path for
`$(pwd)/backend` if `pwd` doesn't resolve the way you expect.)

`--network learnmapapp_default` is the network docker-compose created for
the `postgres` service — the container needs to be on it to resolve the
`postgres` hostname in `DATABASE_URL`. Migrations run automatically on
startup (`database.Migrate` in `main.go`), so there's no separate
migration step.

First boot downloads Go module dependencies, so it takes ~30-60s before
the server is actually listening. Check progress with:

```bash
docker logs -f learnmap-backend
```

Verify it's up:

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

### After changing backend code

`go run` doesn't hot-reload. Restart to pick up changes:

```bash
docker restart learnmap-backend
```

If you changed `go.mod`/`go.sum` or want a totally clean start:

```bash
docker rm -f learnmap-backend
# then re-run the `docker run -d --name learnmap-backend ...` command above
```

### Stopping everything

```bash
docker rm -f learnmap-backend
docker compose down          # stops postgres; add -v to also wipe its data volume
```

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `PORT` | no | `8080` | |
| `DATABASE_URL` | **yes** | — | `postgres://user:pass@host:5432/db?sslmode=disable` |
| `JWT_SECRET` | **yes** | — | Any long random string in dev |
| `INVITE_CODE` | no | — | Required by `POST /auth/register`; the pilot's shared invite code |
| `ACCESS_TOKEN_TTL_MINUTES` | no | `15` | |
| `REFRESH_TOKEN_TTL_DAYS` | no | `30` | |
| `REFRESH_COOKIE_NAME` | no | `refresh_token` | |
| `REFRESH_COOKIE_DOMAIN` | no | (empty) | |
| `REFRESH_COOKIE_SECURE` | no | `true` | Set `false` for local http dev, `true` in production (https) |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:5173` | Comma-separated |

See `.env.example` for a copyable template — note it's not auto-loaded
by the `docker run` flow above (no `.env` file is mounted); it's there
for reference and for anyone running the binary directly on a host with
Go installed, where `godotenv.Load()` in `main.go` will pick it up.

## Running tests

Tests hit a real Postgres, not mocks (project convention — see
`.claude/agents/testing-agent.md`). Point `TEST_DATABASE_URL` at the
same Postgres container and run with `-p 1` (parallel package tests
deadlock against the shared test DB):

```bash
docker run --rm --network learnmapapp_default \
  -v "$(pwd)/backend:/app" -w /app \
  -e TEST_DATABASE_URL="postgres://learnmap:learnmap_dev_password@postgres:5432/learnmap?sslmode=disable" \
  golang:latest go test ./... -p 1
```

## API

See `docs/ARCHITECTURE.md` for the full endpoint list and
`postman/LearnMap.postman_collection.json` for a runnable, self-verifying
request collection covering every endpoint.
