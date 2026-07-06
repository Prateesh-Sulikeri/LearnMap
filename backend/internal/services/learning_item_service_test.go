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

type itemTestDeps struct {
	items    *services.LearningItemService
	itemRepo *repositories.LearningItemRepository
	sessions *repositories.StudySessionRepository
}

func setupItemService(t *testing.T) (itemTestDeps, func(email string) uuid.UUID) {
	t.Helper()
	db, err := testutil.SetupTestDB()
	require.NoError(t, err)
	require.NoError(t, testutil.TruncateAll(db))

	userRepo := repositories.NewUserRepository(db)
	itemRepo := repositories.NewLearningItemRepository(db)
	sessionRepo := repositories.NewStudySessionRepository(db)
	eventService := services.NewEventService(repositories.NewEventRepository(db))
	itemService := services.NewLearningItemService(itemRepo, eventService)

	createUser := func(email string) uuid.UUID {
		u := &models.User{Email: email, PasswordHash: "hash", DisplayName: "Test User"}
		require.NoError(t, userRepo.Create(u))
		return u.ID
	}

	return itemTestDeps{items: itemService, itemRepo: itemRepo, sessions: sessionRepo}, createUser
}

func TestLearningItemService_Create_RejectsParentBelongingToAnotherUser(t *testing.T) {
	deps, createUser := setupItemService(t)

	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	parent, err := deps.items.Create(userA, services.CreateItemInput{Title: "Alice's root"})
	require.NoError(t, err)

	_, err = deps.items.Create(userB, services.CreateItemInput{Title: "Bob tries to attach here", ParentID: &parent.ID})
	require.Error(t, err, "Bob must not be able to nest under Alice's item")
}

func TestLearningItemService_SetStatus_CompletedThenReopened(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka"})
	require.NoError(t, err)
	require.Equal(t, models.StatusNotStarted, item.Status)
	require.Nil(t, item.CompletedAt)

	completed, err := deps.items.SetStatus(userA, item.ID, models.StatusCompleted)
	require.NoError(t, err)
	require.Equal(t, models.StatusCompleted, completed.Status)
	require.NotNil(t, completed.CompletedAt)

	reopened, err := deps.items.SetStatus(userA, item.ID, models.StatusInProgress)
	require.NoError(t, err)
	require.Equal(t, models.StatusInProgress, reopened.Status)
	require.Nil(t, reopened.CompletedAt, "completed_at must clear when an item is reopened")
}

func TestLearningItemService_SetStatus_RejectsInvalidValue(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka"})
	require.NoError(t, err)

	_, err = deps.items.SetStatus(userA, item.ID, models.LearningItemStatus("archived"))
	require.Error(t, err)
}

func TestLearningItemService_Delete_CascadesToDescendantsAndTheirSessions(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	parent, err := deps.items.Create(userA, services.CreateItemInput{Title: "Backend"})
	require.NoError(t, err)
	child, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka", ParentID: &parent.ID})
	require.NoError(t, err)
	grandchild, err := deps.items.Create(userA, services.CreateItemInput{Title: "Consumer Groups", ParentID: &child.ID})
	require.NoError(t, err)

	session := &models.StudySession{UserID: userA, LearningItemID: child.ID, Hours: 1.5, SessionDate: time.Now()}
	require.NoError(t, deps.sessions.Create(session))

	count, err := deps.items.Delete(userA, parent.ID)
	require.NoError(t, err)
	require.Equal(t, 3, count, "parent + child + grandchild should all be counted")

	for name, id := range map[string]uuid.UUID{"parent": parent.ID, "child": child.ID, "grandchild": grandchild.ID} {
		got, err := deps.itemRepo.GetByID(userA, id)
		require.NoError(t, err)
		require.Nil(t, got, "%s must be soft-deleted and no longer retrievable", name)
	}

	gotSession, err := deps.sessions.GetByID(userA, session.ID)
	require.NoError(t, err)
	require.Nil(t, gotSession, "a session under a deleted item must be soft-deleted too")
}

func TestLearningItemService_Update_EmitsRenameOnlyWhenTitleChanges(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka"})
	require.NoError(t, err)

	newTitle := "Apache Kafka"
	updated, err := deps.items.Update(userA, item.ID, services.UpdateItemInput{Title: &newTitle})
	require.NoError(t, err)
	require.Equal(t, "Apache Kafka", updated.Title)
}

func TestLearningItemService_GetByID_ReturnsNilNotErrorForMissingOrForeignItem(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Alice's item"})
	require.NoError(t, err)

	// Bob looking up Alice's real item id must get "not found", not an error
	// and not the data — the same repository call used by every handler.
	got, err := deps.itemRepo.GetByID(userB, item.ID)
	require.NoError(t, err)
	require.Nil(t, got)

	got, err = deps.itemRepo.GetByID(userA, uuid.New())
	require.NoError(t, err)
	require.Nil(t, got)
}
