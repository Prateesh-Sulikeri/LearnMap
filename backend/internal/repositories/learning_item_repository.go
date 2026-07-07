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

// GetDeletedByID returns a soft-deleted item (Unscoped so the normal
// not-deleted query scope doesn't hide it), or nil if it doesn't exist,
// belongs to another user, or isn't actually deleted — same "don't
// distinguish the reasons" rule as GetByID (ADR-016).
func (r *LearningItemRepository) GetDeletedByID(userID, itemID uuid.UUID) (*models.LearningItem, error) {
	var item models.LearningItem
	err := r.db.Unscoped().
		Where("id = ? AND user_id = ? AND deleted_at IS NOT NULL", itemID, userID).
		First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// ListDeletedRootsByUser returns only the "trash roots" — deleted items
// whose parent is either absent or not itself deleted. A cascade delete
// soft-deletes an entire subtree at once, but the trash view should show
// only what the user actually clicked delete on, not every descendant that
// came along with it.
func (r *LearningItemRepository) ListDeletedRootsByUser(userID uuid.UUID) ([]models.LearningItem, error) {
	var items []models.LearningItem
	err := r.db.Unscoped().
		Where(`user_id = ? AND deleted_at IS NOT NULL AND (
			parent_id IS NULL OR EXISTS (
				SELECT 1 FROM learning_items parent
				WHERE parent.id = learning_items.parent_id AND parent.deleted_at IS NULL
			)
		)`, userID).
		Order("deleted_at desc").
		Find(&items).Error
	return items, err
}

// ListAllIncludingDeletedByUser returns every item regardless of soft-delete
// status — used to walk the full parent/child map (via collectSubtreeIDs)
// when restoring a subtree that was deleted together.
func (r *LearningItemRepository) ListAllIncludingDeletedByUser(userID uuid.UUID) ([]models.LearningItem, error) {
	var items []models.LearningItem
	err := r.db.Unscoped().Where("user_id = ?", userID).Find(&items).Error
	return items, err
}

// RestoreItems clears deleted_at for every item in itemIDs and any
// study_sessions logged against them — the mirror of SoftDeleteWithSessions.
func (r *LearningItemRepository) RestoreItems(userID uuid.UUID, itemIDs []uuid.UUID) error {
	if len(itemIDs) == 0 {
		return nil
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Model(&models.StudySession{}).
			Where("user_id = ? AND learning_item_id IN ?", userID, itemIDs).
			Update("deleted_at", nil).Error; err != nil {
			return err
		}
		return tx.Unscoped().Model(&models.LearningItem{}).
			Where("user_id = ? AND id IN ?", userID, itemIDs).
			Update("deleted_at", nil).Error
	})
}

// HardDeleteItems permanently removes every item in itemIDs (already
// validated by the caller to belong to userID and already be soft-deleted)
// along with any study_sessions referencing them — no recovery possible
// after this, unlike SoftDeleteWithSessions.
func (r *LearningItemRepository) HardDeleteItems(userID uuid.UUID, itemIDs []uuid.UUID) error {
	if len(itemIDs) == 0 {
		return nil
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().
			Where("user_id = ? AND learning_item_id IN ?", userID, itemIDs).
			Delete(&models.StudySession{}).Error; err != nil {
			return err
		}
		return tx.Unscoped().
			Where("user_id = ? AND id IN ?", userID, itemIDs).
			Delete(&models.LearningItem{}).Error
	})
}

// ListAllDeletedByUser returns every soft-deleted item for userID
// (regardless of whether it's a trash root or a descendant that came along
// with a cascade delete) — used by EmptyTrash and the retention sweep to
// find every id that needs hard-deleting, not just the roots ListTrash shows.
func (r *LearningItemRepository) ListAllDeletedByUser(userID uuid.UUID) ([]models.LearningItem, error) {
	var items []models.LearningItem
	err := r.db.Unscoped().Where("user_id = ? AND deleted_at IS NOT NULL", userID).Find(&items).Error
	return items, err
}

// ListDeletedRootsOlderThan returns trash roots (same definition as
// ListDeletedRootsByUser) whose deleted_at is before cutoff — used by the
// retention sweep to find what's aged out.
func (r *LearningItemRepository) ListDeletedRootsOlderThan(userID uuid.UUID, cutoff time.Time) ([]models.LearningItem, error) {
	var items []models.LearningItem
	err := r.db.Unscoped().
		Where(`user_id = ? AND deleted_at IS NOT NULL AND deleted_at < ? AND (
			parent_id IS NULL OR EXISTS (
				SELECT 1 FROM learning_items parent
				WHERE parent.id = learning_items.parent_id AND parent.deleted_at IS NULL
			)
		)`, userID, cutoff).
		Find(&items).Error
	return items, err
}
