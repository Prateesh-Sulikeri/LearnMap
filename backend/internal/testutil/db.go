// Package testutil provides a real, ephemeral-per-test Postgres connection
// for integration tests. Per the project's testing rules, the database is
// never mocked — tests run against the same engine and constraints
// (cascades, CHECK constraints) production uses.
package testutil

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"learnmap-backend/internal/database"

	"gorm.io/gorm"
)

// TestDatabaseURL returns the connection string used by tests.
//
// This MUST NEVER point at the same database the dev/prod backend actually
// runs against — TruncateAll below wipes every row in the target database on
// every test run, with no recovery possible. It previously defaulted to
// `learnmap`, the same database docker-compose.yml's `postgres` service and
// the running backend container both use — every test run was silently
// truncating real, live data (confirmed: a user's account and everything in
// it was wiped this way). Defaults to a dedicated `learnmap_test` database
// in the same Postgres instance now; override with TEST_DATABASE_URL only to
// point at another *dedicated test* database, never a dev/prod one.
func TestDatabaseURL() string {
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		return url
	}
	return "postgres://learnmap:learnmap_dev_password@localhost:5432/learnmap_test?sslmode=disable"
}

func migrationsDir() string {
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(thisFile), "..", "..", "migrations")
}

// guardTestDatabaseName refuses to proceed unless the database name in url
// contains "test" — a hard structural guard, not just a naming convention,
// against ever pointing TruncateAll at a real dev/prod database again
// (exactly the mistake that once wiped a live user's account). If a
// genuinely different test database naming scheme is ever needed, adjust
// this check deliberately rather than removing it.
func guardTestDatabaseName(url string) error {
	lastSlash := strings.LastIndex(url, "/")
	dbName := url
	if lastSlash != -1 {
		dbName = url[lastSlash+1:]
	}
	if idx := strings.IndexAny(dbName, "?"); idx != -1 {
		dbName = dbName[:idx]
	}
	if !strings.Contains(strings.ToLower(dbName), "test") {
		return fmt.Errorf("testutil: refusing to run against database %q — its name doesn't contain \"test\"; "+
			"this almost certainly means TEST_DATABASE_URL points at a real dev/prod database, "+
			"which TruncateAll would wipe with no recovery possible", dbName)
	}
	return nil
}

// SetupTestDB applies pending migrations and returns a connected *gorm.DB.
func SetupTestDB() (*gorm.DB, error) {
	url := TestDatabaseURL()
	if err := guardTestDatabaseName(url); err != nil {
		return nil, err
	}
	if err := database.Migrate(url, migrationsDir()); err != nil {
		return nil, err
	}
	return database.Connect(url)
}

// TruncateAll wipes every table so each test starts from a clean slate.
// Tests in this project run sequentially (no t.Parallel()) precisely
// because this truncates shared state.
func TruncateAll(db *gorm.DB) error {
	var currentDB string
	if err := db.Raw("SELECT current_database()").Scan(&currentDB).Error; err != nil {
		return err
	}
	if !strings.Contains(strings.ToLower(currentDB), "test") {
		return fmt.Errorf("testutil: refusing to truncate database %q — its name doesn't contain \"test\"", currentDB)
	}

	tables := []string{"events", "study_sessions", "learning_items", "refresh_tokens", "users"}
	for _, t := range tables {
		if err := db.Exec("TRUNCATE TABLE " + t + " CASCADE").Error; err != nil {
			return err
		}
	}
	return nil
}
