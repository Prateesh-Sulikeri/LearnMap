package services

import (
	"time"

	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"

	"github.com/google/uuid"
)

type StudySessionService struct {
	sessions *repositories.StudySessionRepository
	items    *repositories.LearningItemRepository
	events   *EventService
}

func NewStudySessionService(sessions *repositories.StudySessionRepository, items *repositories.LearningItemRepository, events *EventService) *StudySessionService {
	return &StudySessionService{sessions: sessions, items: items, events: events}
}

type CreateSessionInput struct {
	LearningItemID uuid.UUID
	Hours          float64
	Notes          *string
	SessionDate    time.Time
}

func (s *StudySessionService) Create(userID uuid.UUID, input CreateSessionInput) (*models.StudySession, error) {
	if input.Hours <= 0 || input.Hours > 24 {
		return nil, apperror.Validation("hours must be greater than 0 and at most 24", map[string]string{"hours": "out of range"})
	}

	item, err := s.items.GetByID(userID, input.LearningItemID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperror.Validation("learning item not found", map[string]string{"learning_item_id": "not found"})
	}

	session := &models.StudySession{
		UserID:         userID,
		LearningItemID: input.LearningItemID,
		Hours:          input.Hours,
		Notes:          input.Notes,
		SessionDate:    input.SessionDate,
	}
	if err := s.sessions.Create(session); err != nil {
		return nil, err
	}

	_ = s.events.Record(userID, models.EventSessionAdded, models.EntityStudySession, session.ID, map[string]interface{}{
		"learning_item_id": input.LearningItemID.String(),
		"hours":            input.Hours,
	})

	return session, nil
}

func (s *StudySessionService) List(userID uuid.UUID, filter repositories.SessionFilter) ([]models.StudySession, error) {
	return s.sessions.List(userID, filter)
}

func (s *StudySessionService) Delete(userID, sessionID uuid.UUID) error {
	session, err := s.sessions.GetByID(userID, sessionID)
	if err != nil {
		return err
	}
	if session == nil {
		return apperror.NotFound("study session not found")
	}

	if err := s.sessions.Delete(userID, sessionID); err != nil {
		return err
	}

	_ = s.events.Record(userID, models.EventSessionDeleted, models.EntityStudySession, sessionID, nil)
	return nil
}
