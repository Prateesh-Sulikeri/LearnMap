package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// StudySession carries user_id directly even though it's derivable through
// LearningItemID's owner — intentional defense in depth (ADR-011) so every
// query can filter WHERE user_id = ? without depending on a join being
// written correctly every time.
type StudySession struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID         uuid.UUID `gorm:"type:uuid;not null;index"`
	LearningItemID uuid.UUID `gorm:"type:uuid;not null;index"`
	Hours          float64   `gorm:"not null"`
	Notes          *string
	SessionDate    time.Time `gorm:"type:date;not null"`
	CreatedAt      time.Time
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

func (StudySession) TableName() string {
	return "study_sessions"
}
