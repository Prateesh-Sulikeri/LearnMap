package services_test

import (
	"testing"
	"time"

	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"
	"learnmap-backend/internal/services"
	"learnmap-backend/internal/testutil"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAuthService(t *testing.T) (*services.AuthService, *gorm.DB) {
	t.Helper()
	db, err := testutil.SetupTestDB()
	require.NoError(t, err)
	require.NoError(t, testutil.TruncateAll(db))

	userRepo := repositories.NewUserRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	authService := services.NewAuthService(userRepo, refreshTokenRepo, "test-jwt-secret", 15*time.Minute, 30*24*time.Hour, "")
	return authService, db
}

// TestRefresh_AllowsReuseWithinGraceWindow proves the fix for a real bug:
// two tabs/devices sharing one login each hold an independent in-memory
// access token. If both happen to expire close together, both fire a
// refresh using the same (still-current) cookie value at nearly the same
// time. Without a grace window, the loser's request — carrying a token the
// winner's request just rotated away — would be rejected outright, logging
// out a perfectly legitimate session. See ADR-031.
func TestRefresh_AllowsReuseWithinGraceWindow(t *testing.T) {
	authService, _ := setupAuthService(t)

	result, err := authService.Register("racer@example.com", "password123", "Racer", "")
	require.NoError(t, err)
	firstRefreshToken := result.RefreshToken

	// "Tab A" refreshes first — this rotates the token.
	afterA, err := authService.Refresh(firstRefreshToken)
	require.NoError(t, err)
	require.NotEmpty(t, afterA.AccessToken)

	// "Tab B" refreshes moments later, still holding the now-superseded
	// token (it read the cookie before Tab A's response updated it) — this
	// must still succeed, not be treated as an invalid/stolen token.
	afterB, err := authService.Refresh(firstRefreshToken)
	require.NoError(t, err, "a refresh token reused within the grace window must still succeed")
	require.NotEmpty(t, afterB.AccessToken)
}

// TestRefresh_RejectsReuseAfterGraceWindowExpires proves the grace window is
// bounded — a token reused well after its rotation (simulated here by
// backdating revoked_at past the grace window, rather than a real 30s
// sleep) is correctly rejected, same as before this fix.
func TestRefresh_RejectsReuseAfterGraceWindowExpires(t *testing.T) {
	authService, db := setupAuthService(t)

	result, err := authService.Register("staleracer@example.com", "password123", "Stale Racer", "")
	require.NoError(t, err)
	firstRefreshToken := result.RefreshToken

	_, err = authService.Refresh(firstRefreshToken)
	require.NoError(t, err)

	// Backdate the rotated-away token's revoked_at to well before the grace
	// window, simulating a reuse attempt long after rotation rather than a
	// benign near-simultaneous race.
	longAgo := time.Now().Add(-repositories.RefreshTokenReuseGrace - time.Minute)
	require.NoError(t, db.Model(&models.RefreshToken{}).
		Where("revoked_at IS NOT NULL").
		Update("revoked_at", longAgo).Error)

	_, err = authService.Refresh(firstRefreshToken)
	require.Error(t, err, "a refresh token reused long after rotation must still be rejected")
}

// TestRefresh_GraceWindowReuseDoesNotResetRevocationClock proves a token's
// revoked_at is set once, at its first use — not bumped forward on every
// grace-window reuse — so the grace window has a fixed expiry from the
// original rotation instead of being extendable indefinitely.
func TestRefresh_GraceWindowReuseDoesNotResetRevocationClock(t *testing.T) {
	authService, db := setupAuthService(t)

	result, err := authService.Register("clockracer@example.com", "password123", "Clock Racer", "")
	require.NoError(t, err)
	firstRefreshToken := result.RefreshToken

	_, err = authService.Refresh(firstRefreshToken)
	require.NoError(t, err)

	var afterFirstRotation models.RefreshToken
	require.NoError(t, db.Where("revoked_at IS NOT NULL").First(&afterFirstRotation).Error)
	originalRevokedAt := *afterFirstRotation.RevokedAt

	// Reusing the token again within the grace window must not push
	// revoked_at forward.
	_, err = authService.Refresh(firstRefreshToken)
	require.NoError(t, err)

	var afterSecondUse models.RefreshToken
	require.NoError(t, db.Where("id = ?", afterFirstRotation.ID).First(&afterSecondUse).Error)
	require.WithinDuration(t, originalRevokedAt, *afterSecondUse.RevokedAt, time.Second,
		"revoked_at must stay at the original rotation time, not reset on grace-window reuse")
}
