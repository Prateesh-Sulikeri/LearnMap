package testutil

import (
	"strings"
	"testing"
)

// Regression test for a real incident: tests once defaulted to the exact
// same database the dev backend uses, and TruncateAll silently wiped a
// live user's account. This proves the guard actually rejects
// non-test-looking database names rather than just documenting the rule.
func TestGuardTestDatabaseName_RejectsNonTestDatabases(t *testing.T) {
	cases := []struct {
		name    string
		url     string
		wantErr bool
	}{
		{"the exact URL that caused the incident", "postgres://learnmap:pw@postgres:5432/learnmap?sslmode=disable", true},
		{"prod-looking name", "postgres://user:pw@db.example.com:5432/learnmap_production", true},
		{"dedicated test database", "postgres://learnmap:pw@localhost:5432/learnmap_test?sslmode=disable", false},
		{"test database, different case", "postgres://learnmap:pw@localhost:5432/LearnMap_TEST", false},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			err := guardTestDatabaseName(tt.url)
			if tt.wantErr && err == nil {
				t.Fatalf("expected guardTestDatabaseName to reject %q, but it allowed it", tt.url)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected guardTestDatabaseName to allow %q, got: %v", tt.url, err)
			}
		})
	}
}

func TestTestDatabaseURL_DefaultPointsAtDedicatedTestDatabase(t *testing.T) {
	t.Setenv("TEST_DATABASE_URL", "")
	url := TestDatabaseURL()
	if !strings.Contains(strings.ToLower(url), "test") {
		t.Fatalf("default TestDatabaseURL() must point at a database with \"test\" in its name, got: %q", url)
	}
}
