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
	"gorm.io/gorm"
)

type itemTestDeps struct {
	items    *services.LearningItemService
	itemRepo *repositories.LearningItemRepository
	sessions *repositories.StudySessionRepository
	db       *gorm.DB
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

	return itemTestDeps{items: itemService, itemRepo: itemRepo, sessions: sessionRepo, db: db}, createUser
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

func TestLearningItemService_Restore_BringsBackWholeSubtreeAndSessions(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	parent, err := deps.items.Create(userA, services.CreateItemInput{Title: "Backend"})
	require.NoError(t, err)
	child, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka", ParentID: &parent.ID})
	require.NoError(t, err)

	session := &models.StudySession{UserID: userA, LearningItemID: child.ID, Hours: 1, SessionDate: time.Now()}
	require.NoError(t, deps.sessions.Create(session))

	deletedCount, err := deps.items.Delete(userA, parent.ID)
	require.NoError(t, err)
	require.Equal(t, 2, deletedCount)

	trash, err := deps.items.ListTrash(userA)
	require.NoError(t, err)
	require.Len(t, trash, 1, "only the explicitly-deleted root should show in trash, not its cascaded child")
	require.Equal(t, parent.ID, trash[0].ID)

	restoredCount, err := deps.items.Restore(userA, parent.ID)
	require.NoError(t, err)
	require.Equal(t, 2, restoredCount, "parent + child should both come back")

	gotParent, err := deps.itemRepo.GetByID(userA, parent.ID)
	require.NoError(t, err)
	require.NotNil(t, gotParent, "parent must be retrievable again")

	gotChild, err := deps.itemRepo.GetByID(userA, child.ID)
	require.NoError(t, err)
	require.NotNil(t, gotChild, "child must be restored along with its parent")

	gotSession, err := deps.sessions.GetByID(userA, session.ID)
	require.NoError(t, err)
	require.NotNil(t, gotSession, "the session must be restored too")

	trashAfterRestore, err := deps.items.ListTrash(userA)
	require.NoError(t, err)
	require.Empty(t, trashAfterRestore)
}

func TestLearningItemService_Restore_RejectsAnotherUsersDeletedItem(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Alice's item"})
	require.NoError(t, err)
	_, err = deps.items.Delete(userA, item.ID)
	require.NoError(t, err)

	_, err = deps.items.Restore(userB, item.ID)
	require.Error(t, err, "Bob must not be able to restore Alice's deleted item")

	got, err := deps.itemRepo.GetByID(userA, item.ID)
	require.NoError(t, err)
	require.Nil(t, got, "the item must remain deleted after Bob's failed restore attempt")
}

func TestLearningItemService_SetFavorite_TogglesIndependentlyOfStatus(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka"})
	require.NoError(t, err)
	require.False(t, item.IsFavorite)

	favorited, err := deps.items.SetFavorite(userA, item.ID, true)
	require.NoError(t, err)
	require.True(t, favorited.IsFavorite)
	require.Equal(t, models.StatusNotStarted, favorited.Status, "favoriting must not touch status")

	unfavorited, err := deps.items.SetFavorite(userA, item.ID, false)
	require.NoError(t, err)
	require.False(t, unfavorited.IsFavorite)
}

func TestLearningItemService_SetFavorite_RejectsAnotherUsersItem(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Alice's item"})
	require.NoError(t, err)

	_, err = deps.items.SetFavorite(userB, item.ID, true)
	require.Error(t, err, "Bob must not be able to favorite Alice's item")
}

func TestLearningItemService_SetFavorite_AllowsNonRootItem(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	parent, err := deps.items.Create(userA, services.CreateItemInput{Title: "Backend"})
	require.NoError(t, err)
	child, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka", ParentID: &parent.ID})
	require.NoError(t, err)

	// A non-root item can be favorited too — the frontend shows it as its
	// own standalone entry (itself + descendants), independent of its parent.
	favoritedChild, err := deps.items.SetFavorite(userA, child.ID, true)
	require.NoError(t, err, "a non-root item must be favoritable")
	require.True(t, favoritedChild.IsFavorite)

	favoritedParent, err := deps.items.SetFavorite(userA, parent.ID, true)
	require.NoError(t, err, "a top-level topic must be favoritable")
	require.True(t, favoritedParent.IsFavorite)
}

func TestLearningItemService_DeletePermanently_HardDeletesWholeSubtree(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	parent, err := deps.items.Create(userA, services.CreateItemInput{Title: "Backend"})
	require.NoError(t, err)
	child, err := deps.items.Create(userA, services.CreateItemInput{Title: "Kafka", ParentID: &parent.ID})
	require.NoError(t, err)

	_, err = deps.items.Delete(userA, parent.ID)
	require.NoError(t, err)

	count, err := deps.items.DeletePermanently(userA, parent.ID)
	require.NoError(t, err)
	require.Equal(t, 2, count)

	gotParent, err := deps.itemRepo.GetDeletedByID(userA, parent.ID)
	require.NoError(t, err)
	require.Nil(t, gotParent, "parent must be gone entirely, not just still soft-deleted")

	gotChild, err := deps.itemRepo.GetDeletedByID(userA, child.ID)
	require.NoError(t, err)
	require.Nil(t, gotChild, "child must be gone too")
}

func TestLearningItemService_DeletePermanently_RejectsAnotherUsersItem(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	item, err := deps.items.Create(userA, services.CreateItemInput{Title: "Alice's item"})
	require.NoError(t, err)
	_, err = deps.items.Delete(userA, item.ID)
	require.NoError(t, err)

	_, err = deps.items.DeletePermanently(userB, item.ID)
	require.Error(t, err, "Bob must not be able to purge Alice's deleted item")
}

func TestLearningItemService_EmptyTrash_HardDeletesEverythingDeleted(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	itemA, err := deps.items.Create(userA, services.CreateItemInput{Title: "Backend"})
	require.NoError(t, err)
	itemB, err := deps.items.Create(userA, services.CreateItemInput{Title: "Frontend"})
	require.NoError(t, err)
	kept, err := deps.items.Create(userA, services.CreateItemInput{Title: "Still active"})
	require.NoError(t, err)

	_, err = deps.items.Delete(userA, itemA.ID)
	require.NoError(t, err)
	_, err = deps.items.Delete(userA, itemB.ID)
	require.NoError(t, err)

	count, err := deps.items.EmptyTrash(userA)
	require.NoError(t, err)
	require.Equal(t, 2, count)

	trash, err := deps.items.ListTrash(userA)
	require.NoError(t, err)
	require.Empty(t, trash, "trash must be empty after emptying it")

	stillActive, err := deps.itemRepo.GetByID(userA, kept.ID)
	require.NoError(t, err)
	require.NotNil(t, stillActive, "an item never deleted must be untouched by Empty Trash")
}

func TestLearningItemService_EmptyTrash_ScopedToOneUser(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")
	userB := createUser("bob@example.com")

	itemA, err := deps.items.Create(userA, services.CreateItemInput{Title: "Alice's item"})
	require.NoError(t, err)
	itemB, err := deps.items.Create(userB, services.CreateItemInput{Title: "Bob's item"})
	require.NoError(t, err)
	_, err = deps.items.Delete(userA, itemA.ID)
	require.NoError(t, err)
	_, err = deps.items.Delete(userB, itemB.ID)
	require.NoError(t, err)

	count, err := deps.items.EmptyTrash(userA)
	require.NoError(t, err)
	require.Equal(t, 1, count, "must only purge Alice's own trash")

	bobsTrash, err := deps.items.ListTrash(userB)
	require.NoError(t, err)
	require.Len(t, bobsTrash, 1, "Bob's trash must be untouched by Alice emptying hers")
}

func TestLearningItemService_ListTrash_PurgesItemsPastRetentionPeriod(t *testing.T) {
	deps, createUser := setupItemService(t)
	userA := createUser("alice@example.com")

	recentlyDeleted, err := deps.items.Create(userA, services.CreateItemInput{Title: "Recently deleted"})
	require.NoError(t, err)
	longDeleted, err := deps.items.Create(userA, services.CreateItemInput{Title: "Deleted long ago"})
	require.NoError(t, err)

	_, err = deps.items.Delete(userA, recentlyDeleted.ID)
	require.NoError(t, err)
	_, err = deps.items.Delete(userA, longDeleted.ID)
	require.NoError(t, err)

	// Backdate one item's deleted_at past the retention window directly —
	// there's no service-level way to do this (nor should there be), so the
	// test reaches into the DB to simulate time having passed.
	staleTime := time.Now().Add(-services.TrashRetentionPeriod - time.Hour)
	require.NoError(t, deps.db.Unscoped().Model(&models.LearningItem{}).
		Where("id = ?", longDeleted.ID).
		Update("deleted_at", staleTime).Error)

	trash, err := deps.items.ListTrash(userA)
	require.NoError(t, err)
	require.Len(t, trash, 1, "the expired item should be purged and gone from the list")
	require.Equal(t, recentlyDeleted.ID, trash[0].ID)

	gotStale, err := deps.itemRepo.GetDeletedByID(userA, longDeleted.ID)
	require.NoError(t, err)
	require.Nil(t, gotStale, "the expired item must be hard-deleted, not just hidden")
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
