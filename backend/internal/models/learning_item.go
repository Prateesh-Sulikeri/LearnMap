package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LearningItemStatus string

const (
	StatusNotStarted LearningItemStatus = "not_started"
	StatusInProgress LearningItemStatus = "in_progress"
	StatusCompleted  LearningItemStatus = "completed"
)

// LearningItem is a self-referential adjacency-list tree node, always scoped
// to a single owning user. parent_id must belong to the same user_id — that
// invariant is enforced in the service layer, not by the schema alone.
type LearningItem struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID      uuid.UUID  `gorm:"type:uuid;not null;index"`
	ParentID    *uuid.UUID `gorm:"type:uuid;index"`
	Title       string     `gorm:"not null"`
	Description *string
	Status      LearningItemStatus `gorm:"type:text;not null;default:'not_started'"`
	Deadline    *time.Time
	Position    int  `gorm:"not null;default:0"`
	IsFavorite  bool `gorm:"not null;default:false"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CompletedAt *time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

func (LearningItem) TableName() string {
	return "learning_items"
}
