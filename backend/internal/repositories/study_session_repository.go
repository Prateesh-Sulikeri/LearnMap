package repositories

import (
	"errors"
	"time"

	"learnmap-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SessionFilter struct {
	LearningItemID *uuid.UUID
	From           *time.Time
	To             *time.Time
	Limit          int
	Offset         int
}

type StudySessionRepository struct {
	db *gorm.DB
}

func NewStudySessionRepository(db *gorm.DB) *StudySessionRepository {
	return &StudySessionRepository{db: db}
}

func (r *StudySessionRepository) Create(session *models.StudySession) error {
	return r.db.Create(session).Error
}

func (r *StudySessionRepository) GetByID(userID, sessionID uuid.UUID) (*models.StudySession, error) {
	var session models.StudySession
	err := r.db.Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (r *StudySessionRepository) List(userID uuid.UUID, filter SessionFilter) ([]models.StudySession, error) {
	query := r.db.Where("user_id = ?", userID)
	if filter.LearningItemID != nil {
		query = query.Where("learning_item_id = ?", *filter.LearningItemID)
	}
	if filter.From != nil {
		query = query.Where("session_date >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("session_date <= ?", *filter.To)
	}
	query = query.Order("session_date desc, created_at desc")
	if filter.Limit > 0 {
		query = query.Limit(filter.Limit)
	}
	if filter.Offset > 0 {
		query = query.Offset(filter.Offset)
	}

	var sessions []models.StudySession
	err := query.Find(&sessions).Error
	return sessions, err
}

func (r *StudySessionRepository) Update(session *models.StudySession) error {
	// Ensure user_id doesn't change (defense in depth)
	return r.db.Model(session).Updates(session).Error
}

func (r *StudySessionRepository) Delete(userID, sessionID uuid.UUID) error {
	return r.db.Where("id = ? AND user_id = ?", sessionID, userID).Delete(&models.StudySession{}).Error
}

// SumHoursSince returns total logged hours for userID with session_date >= since.
func (r *StudySessionRepository) SumHoursSince(userID uuid.UUID, since time.Time) (float64, error) {
	var total float64
	err := r.db.Model(&models.StudySession{}).
		Where("user_id = ? AND session_date >= ?", userID, since).
		Select("COALESCE(SUM(hours), 0)").
		Scan(&total).Error
	return total, err
}

// DistinctSessionDates returns every date the user logged at least one session, descending.
func (r *StudySessionRepository) DistinctSessionDates(userID uuid.UUID) ([]time.Time, error) {
	var dates []time.Time
	err := r.db.Model(&models.StudySession{}).
		Where("user_id = ?", userID).
		Distinct("session_date").
		Order("session_date desc").
		Pluck("session_date", &dates).Error
	return dates, err
}

type DailyHours struct {
	Date  time.Time
	Hours float64
}

func (r *StudySessionRepository) DailyHoursSince(userID uuid.UUID, since time.Time) ([]DailyHours, error) {
	var rows []DailyHours
	err := r.db.Model(&models.StudySession{}).
		Where("user_id = ? AND session_date >= ?", userID, since).
		Select("session_date as date, SUM(hours) as hours").
		Group("session_date").
		Order("session_date asc").
		Scan(&rows).Error
	return rows, err
}

type TopicHours struct {
	LearningItemID uuid.UUID
	Title          string
	Hours          float64
}

func (r *StudySessionRepository) TopTopics(userID uuid.UUID, limit int) ([]TopicHours, error) {
	var rows []TopicHours
	err := r.db.Table("study_sessions").
		Select("study_sessions.learning_item_id as learning_item_id, learning_items.title as title, SUM(study_sessions.hours) as hours").
		Joins("JOIN learning_items ON learning_items.id = study_sessions.learning_item_id").
		Where("study_sessions.user_id = ? AND study_sessions.deleted_at IS NULL", userID).
		Group("study_sessions.learning_item_id, learning_items.title").
		Order("hours desc").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}
