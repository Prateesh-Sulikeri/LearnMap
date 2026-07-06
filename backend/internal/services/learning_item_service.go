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
