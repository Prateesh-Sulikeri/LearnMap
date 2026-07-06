package services

// Internal (package services) test file — exercises the unexported streak
// algorithm directly as a pure function, no database needed. This is exactly
// the "simpler to unit-test as a pure function" tradeoff noted where
// computeStreak is defined in dashboard_service.go.

import (
	"testing"
	"time"
)

func TestComputeStreak(t *testing.T) {
	now := time.Now()
	day := func(offset int) time.Time { return now.AddDate(0, 0, offset) }

	tests := []struct {
		name     string
		dates    []time.Time
		expected int
	}{
		{"no sessions ever", nil, 0},
		{"only today logged", []time.Time{day(0)}, 1},
		{"today and yesterday logged", []time.Time{day(0), day(-1)}, 2},
		{"gap two days ago breaks the streak at today", []time.Time{day(0), day(-2)}, 1},
		{"today not yet logged but yesterday was — streak continues", []time.Time{day(-1), day(-2)}, 2},
		{"today not logged and a gap before that — streak is zero", []time.Time{day(-2)}, 0},
		{"six-day streak ending yesterday", []time.Time{day(-1), day(-2), day(-3), day(-4), day(-5), day(-6)}, 6},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := computeStreak(tt.dates, now)
			if got != tt.expected {
				t.Errorf("computeStreak() = %d, want %d", got, tt.expected)
			}
		})
	}
}
