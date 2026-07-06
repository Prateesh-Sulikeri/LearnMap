package services

import (
	"encoding/json"
	"log"

	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// EventService is the only way anything writes to the append-only events
// log. It never updates or deletes — that's an invariant of the table
// itself (ADR: future AI compatibility, docs/ARCHITECTURE.md §10).
type EventService struct {
	events *repositories.EventRepository
}

func NewEventService(events *repositories.EventRepository) *EventService {
	return &EventService{events: events}
}

// Record writes an event and also logs (rather than silently swallows) any
// failure. Callers deliberately don't fail the primary operation just
// because the audit write failed — an item create/update/delete should not
// 500 over a logging problem — but a silently lost event would quietly
// corrupt the historical record this table exists to preserve (docs/ARCHITECTURE.md
// §10), so every caller in this codebase discards the error with `_ =` and
// relies on this method to surface the failure instead.
func (s *EventService) Record(userID uuid.UUID, eventType models.EventType, entityType models.EntityType, entityID uuid.UUID, payload map[string]interface{}) error {
	var raw datatypes.JSON
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			log.Printf("event %s for %s %s: failed to marshal payload: %v", eventType, entityType, entityID, err)
			return err
		}
		raw = datatypes.JSON(b)
	}

	event := &models.Event{
		UserID:     userID,
		EventType:  eventType,
		EntityType: entityType,
		EntityID:   entityID,
		Payload:    raw,
	}
	if err := s.events.Create(event); err != nil {
		log.Printf("event %s for %s %s: failed to persist: %v", eventType, entityType, entityID, err)
		return err
	}
	return nil
}
