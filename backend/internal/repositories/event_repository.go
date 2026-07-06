package repositories

import (
	"learnmap-backend/internal/models"

	"gorm.io/gorm"
)

// EventRepository only ever inserts — events is an append-only log
// (write-only from the application's perspective; nothing updates or
// deletes a row here, and the MVP never reads it back through the API).
type EventRepository struct {
	db *gorm.DB
}

func NewEventRepository(db *gorm.DB) *EventRepository {
	return &EventRepository{db: db}
}

func (r *EventRepository) Create(event *models.Event) error {
	return r.db.Create(event).Error
}
