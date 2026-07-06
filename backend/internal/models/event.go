package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type EventType string

const (
	EventTaskCreated    EventType = "TASK_CREATED"
	EventTaskCompleted  EventType = "TASK_COMPLETED"
	EventTaskReopened   EventType = "TASK_REOPENED"
	EventTaskUpdated    EventType = "TASK_UPDATED"
	EventTaskDeleted    EventType = "TASK_DELETED"
	EventTaskRestored   EventType = "TASK_RESTORED"
	EventItemRenamed    EventType = "ITEM_RENAMED"
	EventSessionAdded   EventType = "SESSION_ADDED"
	EventSessionDeleted EventType = "SESSION_DELETED"
)

type EntityType string

const (
	EntityLearningItem EntityType = "learning_item"
	EntityStudySession EntityType = "study_session"
)

// Event is an append-only audit log — nothing in this codebase ever updates
// or deletes a row here. It exists purely so a future AI feature can
// reconstruct a user's learning history by replaying events; the MVP never
// reads it back through the API.
type Event struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID     uuid.UUID      `gorm:"type:uuid;not null;index"`
	EventType  EventType      `gorm:"type:text;not null;index"`
	EntityType EntityType     `gorm:"type:text;not null"`
	EntityID   uuid.UUID      `gorm:"type:uuid;not null"`
	Payload    datatypes.JSON `gorm:"type:jsonb"`
	CreatedAt  time.Time
}

func (Event) TableName() string {
	return "events"
}
