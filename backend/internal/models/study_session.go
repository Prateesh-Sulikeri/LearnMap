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
//
// Scheduling fields (ScheduledStart/ScheduledEnd/ConfirmedAt) enable future-dated
// sessions (honor system). Existing retroactively-logged sessions (Hours set, others null)
// are always shown as complete.
//
// LearningItemID is the "primary" topic (first one chosen) — kept as a real
// column for backward compatibility and simple single-topic queries. A
// session's full topic set (which may cover more than one, migration 000011)
// lives in study_session_topics; TopicIDs is populated by the service layer
// after a separate query, never read/written directly by GORM.
type StudySession struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID         uuid.UUID `gorm:"type:uuid;not null;index"`
	LearningItemID uuid.UUID `gorm:"type:uuid;not null;index"`
	Hours          float64   `gorm:"not null"`
	Notes          *string
	SessionDate    time.Time  `gorm:"type:date;not null"`
	ScheduledStart *time.Time // nullable: null for retroactively-logged sessions
	ScheduledEnd   *time.Time // nullable: when scheduled session was due
	ConfirmedAt    *time.Time // nullable: when scheduled session was marked complete
	CreatedAt      time.Time
	DeletedAt      gorm.DeletedAt `gorm:"index"`
	TopicIDs       []uuid.UUID    `gorm:"-" json:"-"`
}

func (StudySession) TableName() string {
	return "study_sessions"
}

// StudySessionTopic is the many-to-many join between a session and every
// topic it covers (see StudySession.TopicIDs).
type StudySessionTopic struct {
	StudySessionID uuid.UUID `gorm:"type:uuid;primaryKey"`
	LearningItemID uuid.UUID `gorm:"type:uuid;primaryKey"`
}

func (StudySessionTopic) TableName() string {
	return "study_session_topics"
}
