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

// scheduleGraceWindow tolerates a scheduled_start slightly in the past —
// "start right now" is a valid choice, but by the time the request reaches
// the server (client clock skew, form-fill time, network latency), the
// instant the user picked is technically already behind time.Now().
const scheduleGraceWindow = 5 * time.Minute

type CreateSessionInput struct {
	LearningItemIDs []uuid.UUID
	Hours           float64
	Notes           *string
	SessionDate     time.Time
	// ScheduledStart/ScheduledEnd are optional time-of-day info for a
	// retroactive log (e.g. "9am-11am" instead of just "2 hours"). When set,
	// the session is stored pre-confirmed (ConfirmedAt = now) since logging
	// something after the fact means it already happened — unlike
	// CreateScheduled, which reserves a future block pending confirmation.
	ScheduledStart *time.Time
	ScheduledEnd   *time.Time
}

type CreateScheduledSessionInput struct {
	LearningItemIDs []uuid.UUID
	ScheduledStart  time.Time
	ScheduledEnd    time.Time
}

type ConfirmScheduledSessionInput struct {
	Hours *float64
	Notes *string
}

// validateTopics ensures every topic ID is non-empty, deduplicated, and
// actually belongs to userID — never trust IDs from the request body alone.
func (s *StudySessionService) validateTopics(userID uuid.UUID, topicIDs []uuid.UUID) ([]uuid.UUID, error) {
	if len(topicIDs) == 0 {
		return nil, apperror.Validation("at least one topic is required", map[string]string{"learning_item_ids": "required"})
	}
	seen := make(map[uuid.UUID]bool, len(topicIDs))
	unique := make([]uuid.UUID, 0, len(topicIDs))
	for _, id := range topicIDs {
		if seen[id] {
			continue
		}
		seen[id] = true
		item, err := s.items.GetByID(userID, id)
		if err != nil {
			return nil, err
		}
		if item == nil {
			return nil, apperror.Validation("learning item not found", map[string]string{"learning_item_ids": "not found"})
		}
		unique = append(unique, id)
	}
	return unique, nil
}

func (s *StudySessionService) Create(userID uuid.UUID, input CreateSessionInput) (*models.StudySession, error) {
	if input.Hours <= 0 || input.Hours > 24 {
		return nil, apperror.Validation("hours must be greater than 0 and at most 24", map[string]string{"hours": "out of range"})
	}

	topicIDs, err := s.validateTopics(userID, input.LearningItemIDs)
	if err != nil {
		return nil, err
	}

	session := &models.StudySession{
		UserID:         userID,
		LearningItemID: topicIDs[0],
		Hours:          input.Hours,
		Notes:          input.Notes,
		SessionDate:    input.SessionDate,
		ScheduledStart: input.ScheduledStart,
		ScheduledEnd:   input.ScheduledEnd,
	}
	if input.ScheduledStart != nil && input.ScheduledEnd != nil {
		now := time.Now()
		session.ConfirmedAt = &now
	}
	if err := s.sessions.Create(session); err != nil {
		return nil, err
	}
	if err := s.sessions.AddTopics(session.ID, topicIDs); err != nil {
		return nil, err
	}
	session.TopicIDs = topicIDs

	_ = s.events.Record(userID, models.EventSessionAdded, models.EntityStudySession, session.ID, map[string]interface{}{
		"learning_item_ids": topicIDs,
		"hours":             input.Hours,
	})

	return session, nil
}

func (s *StudySessionService) List(userID uuid.UUID, filter repositories.SessionFilter) ([]models.StudySession, error) {
	sessions, err := s.sessions.List(userID, filter)
	if err != nil {
		return nil, err
	}
	if err := s.attachTopics(sessions); err != nil {
		return nil, err
	}
	return sessions, nil
}

// attachTopics batch-fetches each session's full topic set and populates its
// (non-persisted) TopicIDs field in place.
func (s *StudySessionService) attachTopics(sessions []models.StudySession) error {
	if len(sessions) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, len(sessions))
	for i, sess := range sessions {
		ids[i] = sess.ID
	}
	topicsBySession, err := s.sessions.TopicIDsForSessions(ids)
	if err != nil {
		return err
	}
	for i := range sessions {
		if topics, ok := topicsBySession[sessions[i].ID]; ok {
			sessions[i].TopicIDs = topics
		} else {
			sessions[i].TopicIDs = []uuid.UUID{sessions[i].LearningItemID}
		}
	}
	return nil
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

// CreateScheduled reserves a future time block for one or more topics (honor
// system). ScheduledEnd and ScheduledStart define the time window; no
// Hours/SessionDate yet. ScheduledStart may be "now" — a small grace window
// tolerates it landing slightly in the past by the time the request arrives.
func (s *StudySessionService) CreateScheduled(userID uuid.UUID, input CreateScheduledSessionInput) (*models.StudySession, error) {
	if !input.ScheduledEnd.After(input.ScheduledStart) {
		return nil, apperror.Validation("scheduled_end must be after scheduled_start", map[string]string{"scheduled_end": "invalid range"})
	}
	if input.ScheduledStart.Before(time.Now().Add(-scheduleGraceWindow)) {
		return nil, apperror.Validation("scheduled_start must be now or in the future", map[string]string{"scheduled_start": "cannot schedule in the past"})
	}

	topicIDs, err := s.validateTopics(userID, input.LearningItemIDs)
	if err != nil {
		return nil, err
	}

	// Hours stays 0 until confirmation; session_date is derived from the
	// start date (updated to reflect actual completion on confirm).
	session := &models.StudySession{
		UserID:         userID,
		LearningItemID: topicIDs[0],
		Hours:          0.0,
		ScheduledStart: &input.ScheduledStart,
		ScheduledEnd:   &input.ScheduledEnd,
		SessionDate:    input.ScheduledStart,
	}
	if err := s.sessions.Create(session); err != nil {
		return nil, err
	}
	if err := s.sessions.AddTopics(session.ID, topicIDs); err != nil {
		return nil, err
	}
	session.TopicIDs = topicIDs

	_ = s.events.Record(userID, models.EventSessionAdded, models.EntityStudySession, session.ID, map[string]interface{}{
		"learning_item_ids": topicIDs,
		"scheduled_start":   input.ScheduledStart,
		"scheduled_end":     input.ScheduledEnd,
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
	if time.Now().Before(*session.ScheduledStart) {
		return nil, apperror.Validation("cannot confirm before the scheduled session has started", map[string]string{"scheduled_start": "not yet begun"})
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
	topics, err := s.sessions.TopicIDsForSessions([]uuid.UUID{session.ID})
	if err != nil {
		return nil, err
	}
	if ids, ok := topics[session.ID]; ok {
		session.TopicIDs = ids
	} else {
		session.TopicIDs = []uuid.UUID{session.LearningItemID}
	}

	_ = s.events.Record(userID, models.EventSessionAdded, models.EntityStudySession, sessionID, map[string]interface{}{
		"learning_item_id": session.LearningItemID.String(),
		"hours":            hours,
		"confirmed_at":     now,
	})

	return session, nil
}
