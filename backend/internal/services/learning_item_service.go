package services

import (
	"time"

	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"

	"github.com/google/uuid"
)

// LearningItemService holds every business rule for the learning hierarchy:
// parent-ownership validation, status transitions, cascade soft-delete, and
// event emission. Repositories underneath do no validation of their own.
type LearningItemService struct {
	items  *repositories.LearningItemRepository
	events *EventService
}

func NewLearningItemService(items *repositories.LearningItemRepository, events *EventService) *LearningItemService {
	return &LearningItemService{items: items, events: events}
}

type CreateItemInput struct {
	ParentID    *uuid.UUID
	Title       string
	Description *string
	Deadline    *time.Time
}

func (s *LearningItemService) Create(userID uuid.UUID, input CreateItemInput) (*models.LearningItem, error) {
	if input.ParentID != nil {
		parent, err := s.items.GetByID(userID, *input.ParentID)
		if err != nil {
			return nil, err
		}
		if parent == nil {
			return nil, apperror.Validation("parent item not found", map[string]string{"parent_id": "not found"})
		}
	}

	item := &models.LearningItem{
		UserID:      userID,
		ParentID:    input.ParentID,
		Title:       input.Title,
		Description: input.Description,
		Status:      models.StatusNotStarted,
		Deadline:    input.Deadline,
	}
	if err := s.items.Create(item); err != nil {
		return nil, err
	}

	_ = s.events.Record(userID, models.EventTaskCreated, models.EntityLearningItem, item.ID, map[string]interface{}{"title": item.Title})

	return item, nil
}

func (s *LearningItemService) List(userID uuid.UUID) ([]models.LearningItem, error) {
	return s.items.ListByUser(userID)
}

type UpdateItemInput struct {
	Title       *string
	Description *string
	Deadline    *time.Time
}

func (s *LearningItemService) Update(userID, itemID uuid.UUID, input UpdateItemInput) (*models.LearningItem, error) {
	item, err := s.items.GetByID(userID, itemID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperror.NotFound("learning item not found")
	}

	renamed := false
	if input.Title != nil && *input.Title != item.Title {
		item.Title = *input.Title
		renamed = true
	}
	if input.Description != nil {
		item.Description = input.Description
	}
	if input.Deadline != nil {
		item.Deadline = input.Deadline
	}

	if err := s.items.Update(item); err != nil {
		return nil, err
	}

	if renamed {
		_ = s.events.Record(userID, models.EventItemRenamed, models.EntityLearningItem, item.ID, map[string]interface{}{"title": item.Title})
	} else {
		_ = s.events.Record(userID, models.EventTaskUpdated, models.EntityLearningItem, item.ID, nil)
	}

	return item, nil
}

func (s *LearningItemService) SetStatus(userID, itemID uuid.UUID, status models.LearningItemStatus) (*models.LearningItem, error) {
	switch status {
	case models.StatusNotStarted, models.StatusInProgress, models.StatusCompleted:
	default:
		return nil, apperror.Validation("invalid status", map[string]string{"status": "must be one of not_started, in_progress, completed"})
	}

	item, err := s.items.GetByID(userID, itemID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperror.NotFound("learning item not found")
	}

	wasCompleted := item.Status == models.StatusCompleted
	item.Status = status

	var eventType models.EventType
	switch {
	case status == models.StatusCompleted && !wasCompleted:
		now := time.Now()
		item.CompletedAt = &now
		eventType = models.EventTaskCompleted
	case status != models.StatusCompleted && wasCompleted:
		item.CompletedAt = nil
		eventType = models.EventTaskReopened
	default:
		eventType = models.EventTaskUpdated
	}

	if err := s.items.Update(item); err != nil {
		return nil, err
	}
	_ = s.events.Record(userID, eventType, models.EntityLearningItem, item.ID, map[string]interface{}{"status": string(status)})

	return item, nil
}

// SetFavorite toggles whether itemID shows up in the Favs tab — a plain
// user-chosen flag, independent of status (a favorite can be active or
// completed) and independent of the tree position (no cascade to children).
func (s *LearningItemService) SetFavorite(userID, itemID uuid.UUID, favorite bool) (*models.LearningItem, error) {
	item, err := s.items.GetByID(userID, itemID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperror.NotFound("learning item not found")
	}

	item.IsFavorite = favorite
	if err := s.items.Update(item); err != nil {
		return nil, err
	}
	return item, nil
}

// Delete soft-deletes itemID and every descendant, plus their study sessions,
// and returns how many items were affected (for the frontend's confirmation UI).
func (s *LearningItemService) Delete(userID, itemID uuid.UUID) (int, error) {
	item, err := s.items.GetByID(userID, itemID)
	if err != nil {
		return 0, err
	}
	if item == nil {
		return 0, apperror.NotFound("learning item not found")
	}

	all, err := s.items.ListByUser(userID)
	if err != nil {
		return 0, err
	}

	toDelete := collectSubtreeIDs(all, itemID)

	if err := s.items.SoftDeleteWithSessions(userID, toDelete); err != nil {
		return 0, err
	}

	_ = s.events.Record(userID, models.EventTaskDeleted, models.EntityLearningItem, itemID, map[string]interface{}{"descendant_count": len(toDelete) - 1})

	return len(toDelete), nil
}

// TrashRetentionPeriod is how long a deleted item stays recoverable in the
// trash before PurgeExpiredTrash permanently removes it.
const TrashRetentionPeriod = 7 * 24 * time.Hour

// ListTrash returns the user's "trash roots" — see
// LearningItemRepository.ListDeletedRootsByUser for exactly what that means.
// Sweeps anything past the retention period first, lazily on read, since
// there's no background job scheduler in this project — a user opening the
// Trash page is the natural moment to enforce the policy.
func (s *LearningItemService) ListTrash(userID uuid.UUID) ([]models.LearningItem, error) {
	if _, err := s.PurgeExpiredTrash(userID); err != nil {
		return nil, err
	}
	return s.items.ListDeletedRootsByUser(userID)
}

// PurgeExpiredTrash permanently removes every trash root (and its
// descendants) whose deletion happened more than TrashRetentionPeriod ago.
// The retention clock runs off the root's own deleted_at — a whole subtree
// was deleted together, so it ages out together.
func (s *LearningItemService) PurgeExpiredTrash(userID uuid.UUID) (int, error) {
	expiredRoots, err := s.items.ListDeletedRootsOlderThan(userID, time.Now().Add(-TrashRetentionPeriod))
	if err != nil {
		return 0, err
	}
	if len(expiredRoots) == 0 {
		return 0, nil
	}

	all, err := s.items.ListAllIncludingDeletedByUser(userID)
	if err != nil {
		return 0, err
	}

	seen := make(map[uuid.UUID]struct{})
	var toDelete []uuid.UUID
	for _, root := range expiredRoots {
		for _, id := range collectSubtreeIDs(all, root.ID) {
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			toDelete = append(toDelete, id)
		}
	}

	if err := s.items.HardDeleteItems(userID, toDelete); err != nil {
		return 0, err
	}
	return len(toDelete), nil
}

// EmptyTrash permanently removes every currently-deleted item for userID —
// the "Empty Trash" action. Unlike PurgeExpiredTrash, this ignores the
// retention period entirely: it's an explicit, user-confirmed action.
func (s *LearningItemService) EmptyTrash(userID uuid.UUID) (int, error) {
	deleted, err := s.items.ListAllDeletedByUser(userID)
	if err != nil {
		return 0, err
	}
	if len(deleted) == 0 {
		return 0, nil
	}

	ids := make([]uuid.UUID, len(deleted))
	for i, item := range deleted {
		ids[i] = item.ID
	}

	if err := s.items.HardDeleteItems(userID, ids); err != nil {
		return 0, err
	}
	return len(ids), nil
}

// DeletePermanently hard-deletes a single trash root and every descendant
// that was soft-deleted along with it — no recovery possible afterward.
func (s *LearningItemService) DeletePermanently(userID, itemID uuid.UUID) (int, error) {
	item, err := s.items.GetDeletedByID(userID, itemID)
	if err != nil {
		return 0, err
	}
	if item == nil {
		return 0, apperror.NotFound("deleted item not found")
	}

	all, err := s.items.ListAllIncludingDeletedByUser(userID)
	if err != nil {
		return 0, err
	}

	toDelete := collectSubtreeIDs(all, itemID)

	if err := s.items.HardDeleteItems(userID, toDelete); err != nil {
		return 0, err
	}
	return len(toDelete), nil
}

// Restore undoes a soft-delete: itemID and every descendant that was
// deleted along with it (mirroring Delete's cascade) come back, along with
// their study sessions. Returns how many items were restored.
func (s *LearningItemService) Restore(userID, itemID uuid.UUID) (int, error) {
	item, err := s.items.GetDeletedByID(userID, itemID)
	if err != nil {
		return 0, err
	}
	if item == nil {
		return 0, apperror.NotFound("deleted item not found")
	}

	all, err := s.items.ListAllIncludingDeletedByUser(userID)
	if err != nil {
		return 0, err
	}

	toRestore := collectSubtreeIDs(all, itemID)

	if err := s.items.RestoreItems(userID, toRestore); err != nil {
		return 0, err
	}

	_ = s.events.Record(userID, models.EventTaskRestored, models.EntityLearningItem, itemID, map[string]interface{}{"restored_count": len(toRestore)})

	return len(toRestore), nil
}

// collectSubtreeIDs returns rootID plus every descendant id, found by walking
// the flat item list in memory — the dataset is small (a single user's
// tree), so this avoids a recursive SQL CTE for no real benefit (ADR-001).
func collectSubtreeIDs(all []models.LearningItem, rootID uuid.UUID) []uuid.UUID {
	childrenOf := make(map[uuid.UUID][]uuid.UUID)
	for _, it := range all {
		if it.ParentID != nil {
			childrenOf[*it.ParentID] = append(childrenOf[*it.ParentID], it.ID)
		}
	}

	result := []uuid.UUID{rootID}
	queue := []uuid.UUID{rootID}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		for _, childID := range childrenOf[current] {
			result = append(result, childID)
			queue = append(queue, childID)
		}
	}
	return result
}
