package handlers_test

import (
	"testing"
	"time"

	"learnmap-backend/internal/handlers"
	"learnmap-backend/internal/repositories"
	"learnmap-backend/internal/routes"
	"learnmap-backend/internal/services"
	"learnmap-backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

const testInviteCode = "pilot-test-code"

// newTestRouter builds the exact same dependency graph as cmd/server/main.go
// against a real, truncated Postgres — the most realistic test we can run
// without actually deploying, and the one that exercises the full
// middleware -> handler -> service -> repository chain end to end.
func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()

	db, err := testutil.SetupTestDB()
	require.NoError(t, err)
	require.NoError(t, testutil.TruncateAll(db))

	userRepo := repositories.NewUserRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	itemRepo := repositories.NewLearningItemRepository(db)
	sessionRepo := repositories.NewStudySessionRepository(db)
	eventRepo := repositories.NewEventRepository(db)

	eventService := services.NewEventService(eventRepo)
	authService := services.NewAuthService(userRepo, refreshTokenRepo, "test-jwt-secret", 15*time.Minute, 30*24*time.Hour, testInviteCode)
	profileService := services.NewProfileService(userRepo)
	itemService := services.NewLearningItemService(itemRepo, eventService)
	sessionService := services.NewStudySessionService(sessionRepo, itemRepo, eventService)
	dashboardService := services.NewDashboardService(sessionRepo, itemRepo)

	authHandler := handlers.NewAuthHandler(authService, "refresh_token", "", false, 30*24*time.Hour)
	profileHandler := handlers.NewProfileHandler(profileService)
	itemHandler := handlers.NewLearningItemHandler(itemService)
	sessionHandler := handlers.NewStudySessionHandler(sessionService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	routes.Register(router, routes.Dependencies{
		AuthService:        authService,
		AuthHandler:        authHandler,
		ProfileHandler:     profileHandler,
		ItemHandler:        itemHandler,
		SessionHandler:     sessionHandler,
		DashboardHandler:   dashboardHandler,
		CORSAllowedOrigins: []string{"http://localhost:5173"},
	})
	return router
}
