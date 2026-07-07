package services_test

import (
	"testing"
	"time"

	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"
	"learnmap-backend/internal/services"
	"learnmap-backend/internal/testutil"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func setupPublicProfileService(t *testing.T) (*services.PublicProfileService, *services.ProfileService, *repositories.StudySessionRepository, *repositories.LearningItemRepository, func(email string) uuid.UUID) {
	t.Helper()
	db, err := testutil.SetupTestDB()
	require.NoError(t, err)
	require.NoError(t, testutil.TruncateAll(db))

	userRepo := repositories.NewUserRepository(db)
	sessionRepo := repositories.NewStudySessionRepository(db)
	itemRepo := repositories.NewLearningItemRepository(db)
	profileService := services.NewProfileService(userRepo)
	publicService := services.NewPublicProfileService(userRepo, sessionRepo)

	createUser := func(email string) uuid.UUID {
		u := &models.User{Email: email, PasswordHash: "hash", DisplayName: "Test User"}
		require.NoError(t, userRepo.Create(u))
		return u.ID
	}

	return publicService, profileService, sessionRepo, itemRepo, createUser
}

func TestPublicProfileService_GetByUsername_ReturnsProfileWhenPublic(t *testing.T) {
	public, profiles, _, _, createUser := setupPublicProfileService(t)
	userA := createUser("alice@example.com")

	username := "alice"
	bio := "Learning Go and React."
	_, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{
		Username:    &username,
		Bio:         &bio,
		SocialLinks: map[string]string{"github": "https://github.com/alice"},
	})
	require.NoError(t, err)

	profile, err := public.GetByUsername("alice")
	require.NoError(t, err)
	require.Equal(t, "Test User", profile.DisplayName)
	require.NotNil(t, profile.Bio)
	require.Equal(t, bio, *profile.Bio)
	require.Equal(t, "https://github.com/alice", profile.SocialLinks["github"])
}

func TestPublicProfileService_GetByUsername_RejectsPrivateProfile(t *testing.T) {
	public, profiles, _, _, createUser := setupPublicProfileService(t)
	userA := createUser("alice@example.com")

	username := "alice"
	isPublic := false
	_, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &username, IsPublic: &isPublic})
	require.NoError(t, err)

	_, err = public.GetByUsername("alice")
	require.Error(t, err, "a private profile must not be viewable via the public endpoint")
}

func TestPublicProfileService_GetByUsername_UnknownUsernameNotFound(t *testing.T) {
	public, _, _, _, _ := setupPublicProfileService(t)

	_, err := public.GetByUsername("nobody-has-this-handle")
	require.Error(t, err)
}

func TestPublicProfileService_GetByUsername_IncludesStreakAndHeatmap(t *testing.T) {
	public, profiles, sessions, items, createUser := setupPublicProfileService(t)
	userA := createUser("alice@example.com")

	username := "alice"
	_, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &username})
	require.NoError(t, err)

	item := &models.LearningItem{UserID: userA, Title: "Kafka", Status: models.StatusNotStarted}
	require.NoError(t, items.Create(item))
	require.NoError(t, sessions.Create(&models.StudySession{
		UserID: userA, LearningItemID: item.ID, Hours: 2, SessionDate: time.Now(),
	}))

	profile, err := public.GetByUsername("alice")
	require.NoError(t, err)
	require.Equal(t, 1, profile.CurrentStreak)
	require.Len(t, profile.Heatmap, 365)

	today := time.Now().Format("2006-01-02")
	found := false
	for _, point := range profile.Heatmap {
		if point.Date == today {
			require.Equal(t, 2.0, point.Hours)
			found = true
		}
	}
	require.True(t, found, "today's logged hours must appear in the heatmap")
}
