package services_test

import (
	"testing"

	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"
	"learnmap-backend/internal/services"
	"learnmap-backend/internal/testutil"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func setupProfileService(t *testing.T) (*services.ProfileService, func(email string) uuid.UUID) {
	t.Helper()
	db, err := testutil.SetupTestDB()
	require.NoError(t, err)
	require.NoError(t, testutil.TruncateAll(db))

	userRepo := repositories.NewUserRepository(db)
	profileService := services.NewProfileService(userRepo)

	createUser := func(email string) uuid.UUID {
		u := &models.User{Email: email, PasswordHash: "hash", DisplayName: "Test User"}
		require.NoError(t, userRepo.Create(u))
		return u.ID
	}

	return profileService, createUser
}

func TestProfileService_UpdateProfile_UsernameNormalizedToLowercase(t *testing.T) {
	profiles, createUser := setupProfileService(t)
	userA := createUser("alice@example.com")

	username := "Alice"
	updated, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &username})
	require.NoError(t, err)
	require.NotNil(t, updated.Username)
	require.Equal(t, "alice", *updated.Username)
}

func TestProfileService_UpdateProfile_RejectsInvalidUsername(t *testing.T) {
	profiles, createUser := setupProfileService(t)
	userA := createUser("alice@example.com")

	cases := []string{"ab", "-startswithhyphen", "has spaces", "way-too-long-a-username-past-thirty-chars"}
	for _, username := range cases {
		u := username
		_, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &u})
		require.Errorf(t, err, "expected %q to be rejected", username)
	}
}

func TestProfileService_UpdateProfile_RejectsUsernameAlreadyTaken(t *testing.T) {
	profiles, createUser := setupProfileService(t)
	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	aliceUsername := "sameusername"
	_, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &aliceUsername})
	require.NoError(t, err)

	bobUsername := "SameUsername"
	_, err = profiles.UpdateProfile(userB, services.UpdateProfileInput{Username: &bobUsername})
	require.Error(t, err, "usernames must be unique case-insensitively")
}

func TestProfileService_UpdateProfile_KeepingOwnUsernameIsNotAConflict(t *testing.T) {
	profiles, createUser := setupProfileService(t)
	userA := createUser("alice@example.com")

	username := "alice"
	_, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &username})
	require.NoError(t, err)

	// Re-saving the profile with the same username (e.g. alongside an
	// unrelated bio edit) must not trip the "already taken" check against
	// the user's own existing username.
	bio := "Learning Go and React."
	_, err = profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &username, Bio: &bio})
	require.NoError(t, err)
}

func TestProfileService_UpdateProfile_EmptyUsernameClearsIt(t *testing.T) {
	profiles, createUser := setupProfileService(t)
	userA := createUser("alice@example.com")

	username := "alice"
	updated, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &username})
	require.NoError(t, err)
	require.NotNil(t, updated.Username)

	empty := ""
	updated, err = profiles.UpdateProfile(userA, services.UpdateProfileInput{Username: &empty})
	require.NoError(t, err)
	require.Nil(t, updated.Username)
}

func TestProfileService_UpdateProfile_SocialLinksOnlyAcceptsKnownPlatforms(t *testing.T) {
	profiles, createUser := setupProfileService(t)
	userA := createUser("alice@example.com")

	updated, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{
		SocialLinks: map[string]string{
			"github":       "https://github.com/alice",
			"myspace":      "https://myspace.com/alice",
			"leetcode":     "https://leetcode.com/alice",
			"emptyIgnored": "",
		},
	})
	require.NoError(t, err)
	require.Equal(t, "https://github.com/alice", updated.SocialLinks["github"])
	require.Equal(t, "https://leetcode.com/alice", updated.SocialLinks["leetcode"])
	require.NotContains(t, updated.SocialLinks, "myspace", "unknown platform keys must be dropped")
	require.NotContains(t, updated.SocialLinks, "emptyIgnored")
}

func TestProfileService_UpdateProfile_IsPublicDefaultsTrueAndCanBeToggled(t *testing.T) {
	profiles, createUser := setupProfileService(t)
	userA := createUser("alice@example.com")

	user, err := profiles.UpdateProfile(userA, services.UpdateProfileInput{})
	require.NoError(t, err)
	require.True(t, user.IsPublic, "profiles are public by default")

	private := false
	user, err = profiles.UpdateProfile(userA, services.UpdateProfileInput{IsPublic: &private})
	require.NoError(t, err)
	require.False(t, user.IsPublic)
}
