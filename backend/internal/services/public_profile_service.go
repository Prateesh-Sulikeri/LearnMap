package services

import (
	"time"

	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/repositories"

	"gorm.io/datatypes"
)

// PublicProfileService powers the unauthenticated, shareable profile view —
// deliberately separate from ProfileService (which is auth-scoped and
// exposes the full account) and from DashboardService (whose learning-item
// data stays private). Only what's safe to show a stranger: identity, bio,
// socials, and the same streak/heatmap gamification already surfaced on the
// exportable stat card.
type PublicProfileService struct {
	users    *repositories.UserRepository
	sessions *repositories.StudySessionRepository
}

func NewPublicProfileService(users *repositories.UserRepository, sessions *repositories.StudySessionRepository) *PublicProfileService {
	return &PublicProfileService{users: users, sessions: sessions}
}

type PublicProfile struct {
	DisplayName   string
	AvatarURL     *string
	Bio           *string
	SocialLinks   datatypes.JSONMap
	JoinedAt      time.Time
	CurrentStreak int
	Heatmap       []DailyHoursPoint
}

// GetByUsername returns NotFound both when the username doesn't exist and
// when the profile is private (ADR-016's "don't distinguish the reasons"
// rule applies here too — a private profile shouldn't be distinguishable
// from a nonexistent one).
func (s *PublicProfileService) GetByUsername(username string) (*PublicProfile, error) {
	user, err := s.users.GetByUsername(username)
	if err != nil {
		return nil, err
	}
	if user == nil || !user.IsPublic {
		return nil, apperror.NotFound("profile not found")
	}

	now := time.Now()
	dates, err := s.sessions.DistinctSessionDates(user.ID)
	if err != nil {
		return nil, err
	}
	streak := computeStreak(dates, now)

	from := startOfDay(now).AddDate(0, 0, -364)
	rows, err := s.sessions.DailyHoursSince(user.ID, from)
	if err != nil {
		return nil, err
	}
	heatmap := fillDailySeries(rows, from, now)

	return &PublicProfile{
		DisplayName:   user.DisplayName,
		AvatarURL:     user.AvatarURL,
		Bio:           user.Bio,
		SocialLinks:   user.SocialLinks,
		JoinedAt:      user.CreatedAt,
		CurrentStreak: streak,
		Heatmap:       heatmap,
	}, nil
}
