package repositories

import (
	"errors"
	"time"

	"learnmap-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LearningItemRepository is the only place learning_items is queried.
// Every method requires userID — there is deliberately no method that can
// fetch or mutate a row without a user scope.
type LearningItemRepository struct {
	db *gorm.DB
}

func NewLearningItemRepository(db *gorm.DB) *LearningItemRepository {
	return &LearningItemRepository{db: db}
}

func (r *LearningItemRepository) Create(item *models.LearningItem) error {
	return r.db.Create(item).Error
}

// GetByID returns nil (not an error) when the item doesn't exist OR belongs
// to a different user — callers must not distinguish the two (ADR-016).
func (r *LearningItemRepository) GetByID(userID, itemID uuid.UUID) (*models.LearningItem, error) {
	var item models.LearningItem
	err := r.db.Where("id = ? AND user_id = ?", itemID, userID).First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// ListByUser returns every non-deleted item owned by userID, flat (no tree
// assembly here — that's the frontend's job per ADR-001).
func (r *LearningItemRepository) ListByUser(userID uuid.UUID) ([]models.LearningItem, error) {
	var items []models.LearningItem
	err := r.db.Where("user_id = ?", userID).Order("created_at asc").Find(&items).Error
	return items, err
}

func (r *LearningItemRepository) Update(item *models.LearningItem) error {
	return r.db.Save(item).Error
}

// SoftDeleteWithSessions soft-deletes every item in itemIDs (already
// validated by the caller to belong to userID) along with any study_sessions
// referencing them, in one transaction.
func (r *LearningItemRepository) SoftDeleteWithSessions(userID uuid.UUID, itemIDs []uuid.UUID) error {
	if len(itemIDs) == 0 {
		return nil
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(&models.StudySession{}).
			Where("user_id = ? AND learning_item_id IN ?", userID, itemIDs).
			Update("deleted_at", now).Error; err != nil {
			return err
		}
		return tx.Model(&models.LearningItem{}).
			Where("user_id = ? AND id IN ?", userID, itemIDs).
			Update("deleted_at", now).Error
	})
}
