package services_test

import (
	"errors"
	"testing"
	"time"

	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"
	"learnmap-backend/internal/services"
	"learnmap-backend/internal/testutil"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type dashboardTestDeps struct {
	dashboard *services.DashboardService
	sessions  *services.StudySessionService
	items     *services.LearningItemService
}

func setupDashboardService(t *testing.T) (dashboardTestDeps, func(email string) uuid.UUID) {
	t.Helper()
	db, err := testutil.SetupTestDB()
	require.NoError(t, err)
	require.NoError(t, testutil.TruncateAll(db))

	userRepo := repositories.NewUserRepository(db)
	itemRepo := repositories.NewLearningItemRepository(db)
	sessionRepo := repositories.NewStudySessionRepository(db)
	eventService := services.NewEventService(repositories.NewEventRepository(db))
	itemService := services.NewLearningItemService(itemRepo, eventService)
	sessionService := services.NewStudySessionService(sessionRepo, itemRepo, eventService)
	dashboardService := services.NewDashboardService(sessionRepo, itemRepo)

	createUser := func(email string) uuid.UUID {
		u := &models.User{Email: email, PasswordHash: "hash", DisplayName: "Test User"}
		require.NoError(t, userRepo.Create(u))
		return u.ID
	}

	return dashboardTestDeps{dashboard: dashboardService, sessions: sessionService, items: itemService}, createUser
}

// TestDashboardService_GetStats_AggregatesByRange logs sessions at known
// day-offsets from "now" and confirms week/month/year aggregation lands each
// session's hours in the correct bucket — the exact math a live curl check
// can't cheaply assert against a moving "now".
func TestDashboardService_GetStats_AggregatesByRange(t *testing.T) {
	deps, createUser := setupDashboardService(t)
	userID := createUser("alice@example.com")

	item, err := deps.items.Create(userID, services.CreateItemInput{Title: "Kafka"})
	require.NoError(t, err)

	now := time.Now()
	logAt := func(daysAgo int, hours float64) {
		_, err := deps.sessions.Create(userID, services.CreateSessionInput{
			LearningItemIDs: []uuid.UUID{item.ID},
			Hours:           hours,
			SessionDate:     now.AddDate(0, 0, -daysAgo),
		})
		require.NoError(t, err)
	}

	logAt(0, 1.0)  // today — in week, month, and year (this month)
	logAt(3, 2.0)  // in week and month
	logAt(10, 3.0) // in month only (past week's 7-day window)
	logAt(40, 4.0) // in year only (past month's 30-day window), previous or same month depending on today

	weekPoints, err := deps.dashboard.GetStats(userID, services.RangeWeek)
	require.NoError(t, err)
	require.Len(t, weekPoints, 7)
	var weekTotal float64
	for _, p := range weekPoints {
		weekTotal += p.Hours
	}
	require.Equal(t, 3.0, weekTotal, "week range should only include today+3-days-ago sessions (1.0+2.0)")

	monthPoints, err := deps.dashboard.GetStats(userID, services.RangeMonth)
	require.NoError(t, err)
	require.Len(t, monthPoints, 30)
	var monthTotal float64
	for _, p := range monthPoints {
		monthTotal += p.Hours
	}
	require.Equal(t, 6.0, monthTotal, "month range should include today+3-days-ago+10-days-ago (1.0+2.0+3.0)")

	yearPoints, err := deps.dashboard.GetStats(userID, services.RangeYear)
	require.NoError(t, err)
	require.Len(t, yearPoints, 12)
	var yearTotal float64
	for _, p := range yearPoints {
		yearTotal += p.Hours
	}
	require.Equal(t, 10.0, yearTotal, "year range should include all four logged sessions (1.0+2.0+3.0+4.0)")
}

func TestDashboardService_GetStats_RejectsInvalidRange(t *testing.T) {
	deps, createUser := setupDashboardService(t)
	userID := createUser("alice@example.com")

	_, err := deps.dashboard.GetStats(userID, services.StatsRange("bogus"))
	require.Error(t, err)
	var appErr *apperror.Error
	require.True(t, errors.As(err, &appErr), "invalid range must be a *apperror.Error, not a bare error")
	require.Equal(t, apperror.CodeValidation, appErr.Code, "invalid range must be a validation error, not a 500")
}

// TestDashboardService_GetStats_UserScoped confirms one user's sessions never
// leak into another user's stats — the same cross-user isolation guarantee
// enforced everywhere else in this codebase.
func TestDashboardService_GetStats_UserScoped(t *testing.T) {
	deps, createUser := setupDashboardService(t)
	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	itemA, err := deps.items.Create(userA, services.CreateItemInput{Title: "Alice's topic"})
	require.NoError(t, err)
	_, err = deps.sessions.Create(userA, services.CreateSessionInput{
		LearningItemIDs: []uuid.UUID{itemA.ID},
		Hours:           5.0,
		SessionDate:     time.Now(),
	})
	require.NoError(t, err)

	bPoints, err := deps.dashboard.GetStats(userB, services.RangeWeek)
	require.NoError(t, err)
	var bTotal float64
	for _, p := range bPoints {
		bTotal += p.Hours
	}
	require.Zero(t, bTotal, "Bob must not see Alice's logged hours")
}
