package services

import (
	"sort"
	"time"

	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"

	"github.com/google/uuid"
)

// DashboardService computes every dashboard/stats figure live, per request,
// user_id-scoped — no cache, no precomputed rollup table (ADR-015).
type DashboardService struct {
	sessions *repositories.StudySessionRepository
	items    *repositories.LearningItemRepository
}

func NewDashboardService(sessions *repositories.StudySessionRepository, items *repositories.LearningItemRepository) *DashboardService {
	return &DashboardService{sessions: sessions, items: items}
}

type DailyHoursPoint struct {
	Date  string  `json:"date"`
	Hours float64 `json:"hours"`
}

type TopicPoint struct {
	LearningItemID string  `json:"learning_item_id"`
	Title          string  `json:"title"`
	Hours          float64 `json:"hours"`
}

type ActivityPoint struct {
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Timestamp time.Time `json:"timestamp"`
}

type Dashboard struct {
	StudyHoursThisWeek   float64               `json:"study_hours_this_week"`
	CurrentStreak        int                   `json:"current_streak"`
	CompletedItems       int64                 `json:"completed_items"`
	PendingItems         int64                 `json:"pending_items"`
	CompletionPercentage float64               `json:"completion_percentage"`
	WeeklyHoursChart     []DailyHoursPoint     `json:"weekly_hours_chart"`
	TopTopics            []TopicPoint          `json:"top_topics"`
	TodaysSessions       []models.StudySession `json:"todays_sessions"`
	RecentActivity       []ActivityPoint       `json:"recent_activity"`
}

func (s *DashboardService) GetDashboard(userID uuid.UUID) (*Dashboard, error) {
	now := time.Now()
	weekStart := startOfWeek(now)

	hoursThisWeek, err := s.sessions.SumHoursSince(userID, weekStart)
	if err != nil {
		return nil, err
	}

	dates, err := s.sessions.DistinctSessionDates(userID)
	if err != nil {
		return nil, err
	}
	streak := computeStreak(dates, now)

	allItems, err := s.items.ListByUser(userID)
	if err != nil {
		return nil, err
	}
	var completed, pending int64
	for _, item := range allItems {
		if item.Status == models.StatusCompleted {
			completed++
		} else {
			pending++
		}
	}
	total := completed + pending
	var completionPct float64
	if total > 0 {
		completionPct = float64(completed) / float64(total) * 100
	}

	sevenDaysAgo := startOfDay(now).AddDate(0, 0, -6)
	dailyRows, err := s.sessions.DailyHoursSince(userID, sevenDaysAgo)
	if err != nil {
		return nil, err
	}
	weeklyChart := fillDailySeries(dailyRows, sevenDaysAgo, now)

	topicRows, err := s.sessions.TopTopics(userID, 5)
	if err != nil {
		return nil, err
	}
	topTopics := make([]TopicPoint, 0, len(topicRows))
	for _, row := range topicRows {
		topTopics = append(topTopics, TopicPoint{LearningItemID: row.LearningItemID.String(), Title: row.Title, Hours: row.Hours})
	}

	todayStart := startOfDay(now)
	todaysSessions, err := s.sessions.List(userID, repositories.SessionFilter{
		From: &todayStart,
		To:   &todayStart,
	})
	if err != nil {
		return nil, err
	}

	recentActivity := buildRecentActivity(allItems, todaysSessions)

	return &Dashboard{
		StudyHoursThisWeek:   hoursThisWeek,
		CurrentStreak:        streak,
		CompletedItems:       completed,
		PendingItems:         pending,
		CompletionPercentage: completionPct,
		WeeklyHoursChart:     weeklyChart,
		TopTopics:            topTopics,
		TodaysSessions:       todaysSessions,
		RecentActivity:       recentActivity,
	}, nil
}

type StatsRange string

const (
	RangeWeek  StatsRange = "week"
	RangeMonth StatsRange = "month"
	RangeYear  StatsRange = "year"
)

type StatsPoint struct {
	Period string  `json:"period"`
	Hours  float64 `json:"hours"`
}

func (s *DashboardService) GetStats(userID uuid.UUID, rng StatsRange) ([]StatsPoint, error) {
	now := time.Now()
	switch rng {
	case RangeWeek:
		from := startOfDay(now).AddDate(0, 0, -6)
		rows, err := s.sessions.DailyHoursSince(userID, from)
		if err != nil {
			return nil, err
		}
		return dailyPointsFrom(rows, from, now), nil
	case RangeMonth:
		from := startOfDay(now).AddDate(0, 0, -29)
		rows, err := s.sessions.DailyHoursSince(userID, from)
		if err != nil {
			return nil, err
		}
		return dailyPointsFrom(rows, from, now), nil
	case RangeYear:
		from := startOfDay(now).AddDate(0, -11, 0)
		rows, err := s.sessions.DailyHoursSince(userID, from)
		if err != nil {
			return nil, err
		}
		return monthlyPointsFrom(rows, now), nil
	default:
		return nil, apperror.Validation("invalid range", map[string]string{"range": "must be one of week, month, year"})
	}
}

func startOfWeek(t time.Time) time.Time {
	weekday := int(t.Weekday())
	if weekday == 0 { // Sunday -> treat as day 7 for a Monday-based week
		weekday = 7
	}
	daysSinceMonday := weekday - 1
	return startOfDay(t.AddDate(0, 0, -daysSinceMonday))
}

func startOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, t.Location())
}

// computeStreak counts consecutive calendar days with at least one logged
// session, walking backward from today. Not having logged *today* yet
// doesn't break the streak; missing yesterday does (ADR-005).
func computeStreak(sessionDates []time.Time, now time.Time) int {
	dateSet := make(map[string]bool, len(sessionDates))
	for _, d := range sessionDates {
		dateSet[d.Format("2006-01-02")] = true
	}

	cursor := startOfDay(now)
	if !dateSet[cursor.Format("2006-01-02")] {
		cursor = cursor.AddDate(0, 0, -1)
	}

	streak := 0
	for dateSet[cursor.Format("2006-01-02")] {
		streak++
		cursor = cursor.AddDate(0, 0, -1)
	}
	return streak
}

func fillDailySeries(rows []repositories.DailyHours, from, to time.Time) []DailyHoursPoint {
	byDate := make(map[string]float64, len(rows))
	for _, r := range rows {
		byDate[r.Date.Format("2006-01-02")] = r.Hours
	}

	var points []DailyHoursPoint
	for d := startOfDay(from); !d.After(startOfDay(to)); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		points = append(points, DailyHoursPoint{Date: key, Hours: byDate[key]})
	}
	return points
}

func dailyPointsFrom(rows []repositories.DailyHours, from, to time.Time) []StatsPoint {
	byDate := make(map[string]float64, len(rows))
	for _, r := range rows {
		byDate[r.Date.Format("2006-01-02")] = r.Hours
	}
	var points []StatsPoint
	for d := startOfDay(from); !d.After(startOfDay(to)); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		points = append(points, StatsPoint{Period: key, Hours: byDate[key]})
	}
	return points
}

func monthlyPointsFrom(rows []repositories.DailyHours, now time.Time) []StatsPoint {
	byMonth := make(map[string]float64)
	for _, r := range rows {
		byMonth[r.Date.Format("2006-01")] += r.Hours
	}

	points := make([]StatsPoint, 0, 12)
	for i := 11; i >= 0; i-- {
		key := now.AddDate(0, -i, 0).Format("2006-01")
		points = append(points, StatsPoint{Period: key, Hours: byMonth[key]})
	}
	return points
}

func buildRecentActivity(items []models.LearningItem, todaysSessions []models.StudySession) []ActivityPoint {
	titleByItemID := make(map[uuid.UUID]string, len(items))
	for _, item := range items {
		titleByItemID[item.ID] = item.Title
	}

	var activity []ActivityPoint
	for _, item := range items {
		activity = append(activity, ActivityPoint{Type: "item_updated", Title: item.Title, Timestamp: item.UpdatedAt})
	}
	for _, session := range todaysSessions {
		activity = append(activity, ActivityPoint{Type: "session_logged", Title: titleByItemID[session.LearningItemID], Timestamp: session.CreatedAt})
	}

	sort.Slice(activity, func(i, j int) bool { return activity[i].Timestamp.After(activity[j].Timestamp) })
	if len(activity) > 10 {
		activity = activity[:10]
	}
	return activity
}
