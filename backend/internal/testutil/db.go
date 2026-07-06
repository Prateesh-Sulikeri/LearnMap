// Package testutil provides a real, ephemeral-per-test Postgres connection
// for integration tests. Per the project's testing rules, the database is
// never mocked — tests run against the same engine and constraints
// (cascades, CHECK constraints) production uses.
package testutil

import (
	"os"
	"path/filepath"
	"runtime"

	"learnmap-backend/internal/database"

	"gorm.io/gorm"
)

// TestDatabaseURL returns the connection string used by tests. Defaults to
// the docker-compose local dev Postgres; override with TEST_DATABASE_URL
// when running tests from inside a container on the compose network.
func TestDatabaseURL() string {
	if url := os.Getenv("TEST_DATABASE_URL"); url != "" {
		return url
	}
	return "postgres://learnmap:learnmap_dev_password@localhost:5432/learnmap?sslmode=disable"
}

func migrationsDir() string {
	_, thisFile, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(thisFile), "..", "..", "migrations")
}

// SetupTestDB applies pending migrations and returns a connected *gorm.DB.
func SetupTestDB() (*gorm.DB, error) {
	url := TestDatabaseURL()
	if err := database.Migrate(url, migrationsDir()); err != nil {
		return nil, err
	}
	return database.Connect(url)
}

// TruncateAll wipes every table so each test starts from a clean slate.
// Tests in this project run sequentially (no t.Parallel()) precisely
// because this truncates shared state.
func TruncateAll(db *gorm.DB) error {
	tables := []string{"events", "study_sessions", "learning_items", "refresh_tokens", "users"}
	for _, t := range tables {
		if err := db.Exec("TRUNCATE TABLE " + t + " CASCADE").Error; err != nil {
			return err
		}
	}
	return nil
}
