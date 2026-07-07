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

type CreateScheduledSessionInput struct {
	LearningItemID uuid.UUID
	ScheduledStart time.Time
	ScheduledEnd   time.Time
}

type ConfirmScheduledSessionInput struct {
	Hours *float64
	Notes *string
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

// CreateScheduled reserves a future time block for a topic (honor system).
// ScheduledEnd and ScheduledStart define the time window; no Hours/SessionDate yet.
func (s *StudySessionService) CreateScheduled(userID uuid.UUID, input CreateScheduledSessionInput) (*models.StudySession, error) {
	if input.ScheduledEnd.Before(input.ScheduledStart) {
		return nil, apperror.Validation("scheduled_end must be after scheduled_start", map[string]string{"scheduled_end": "invalid range"})
	}

	item, err := s.items.GetByID(userID, input.LearningItemID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperror.Validation("learning item not found", map[string]string{"learning_item_id": "not found"})
	}

	// Set Hours to 0 and SessionDate to the start date (will be updated on confirmation)
	hours := 0.0
	sessionDate := input.ScheduledStart
	session := &models.StudySession{
		UserID:         userID,
		LearningItemID: input.LearningItemID,
		Hours:          hours,
		ScheduledStart: &input.ScheduledStart,
		ScheduledEnd:   &input.ScheduledEnd,
		SessionDate:    sessionDate,
	}
	if err := s.sessions.Create(session); err != nil {
		return nil, err
	}

	_ = s.events.Record(userID, models.EventSessionAdded, models.EntityStudySession, session.ID, map[string]interface{}{
		"learning_item_id": input.LearningItemID.String(),
		"scheduled_start":  input.ScheduledStart,
		"scheduled_end":    input.ScheduledEnd,
	})

	return session, nil
}

// ConfirmScheduled marks a scheduled session as complete. Optionally accepts actual
// hours and notes (user can adjust from the scheduled duration). If Hours not provided,
// derives from scheduled duration.
func (s *StudySessionService) ConfirmScheduled(userID, sessionID uuid.UUID, input ConfirmScheduledSessionInput) (*models.StudySession, error) {
	session, err := s.sessions.GetByID(userID, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, apperror.NotFound("study session not found")
	}

	if session.ScheduledEnd == nil {
		return nil, apperror.Validation("session is not scheduled", map[string]string{"scheduled_end": "not set"})
	}

	// Calculate hours if not provided
	hours := input.Hours
	if hours == nil {
		durationHours := session.ScheduledEnd.Sub(*session.ScheduledStart).Hours()
		if durationHours <= 0 || durationHours > 24 {
			return nil, apperror.Validation("invalid scheduled duration", map[string]string{"scheduled_duration": "out of range"})
		}
		hours = &durationHours
	} else if *hours <= 0 || *hours > 24 {
		return nil, apperror.Validation("hours must be greater than 0 and at most 24", map[string]string{"hours": "out of range"})
	}

	now := time.Now()
	session.Hours = *hours
	session.ConfirmedAt = &now
	if input.Notes != nil {
		session.Notes = input.Notes
	}

	if err := s.sessions.Update(session); err != nil {
		return nil, err
	}

	_ = s.events.Record(userID, models.EventSessionAdded, models.EntityStudySession, sessionID, map[string]interface{}{
		"learning_item_id": session.LearningItemID.String(),
		"hours":            hours,
		"confirmed_at":     now,
	})

	return session, nil
}
