package handlers

import (
	"net/http"

	"learnmap-backend/internal/middleware"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	service *services.DashboardService
}

func NewDashboardHandler(service *services.DashboardService) *DashboardHandler {
	return &DashboardHandler{service: service}
}

type dashboardResponse struct {
	StudyHoursThisWeek   float64                    `json:"study_hours_this_week"`
	CurrentStreak        int                        `json:"current_streak"`
	CompletedItems       int64                      `json:"completed_items"`
	PendingItems         int64                      `json:"pending_items"`
	CompletionPercentage float64                    `json:"completion_percentage"`
	WeeklyHoursChart     []services.DailyHoursPoint `json:"weekly_hours_chart"`
	TopTopics            []services.TopicPoint      `json:"top_topics"`
	TodaysSessions       []sessionResponse          `json:"todays_sessions"`
	RecentActivity       []services.ActivityPoint   `json:"recent_activity"`
}

// toDashboardResponse re-shapes the service's Dashboard into the same public
// session DTO the /sessions endpoint uses — the service layer works with
// domain models (models.StudySession); shaping the HTTP response, including
// hiding internal fields like DeletedAt, is the handler's job.
func toDashboardResponse(d *services.Dashboard) dashboardResponse {
	sessions := make([]sessionResponse, 0, len(d.TodaysSessions))
	for i := range d.TodaysSessions {
		sessions = append(sessions, toSessionResponse(&d.TodaysSessions[i]))
	}
	return dashboardResponse{
		StudyHoursThisWeek:   d.StudyHoursThisWeek,
		CurrentStreak:        d.CurrentStreak,
		CompletedItems:       d.CompletedItems,
		PendingItems:         d.PendingItems,
		CompletionPercentage: d.CompletionPercentage,
		WeeklyHoursChart:     d.WeeklyHoursChart,
		TopTopics:            d.TopTopics,
		TodaysSessions:       sessions,
		RecentActivity:       d.RecentActivity,
	}
}

func (h *DashboardHandler) GetDashboard(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	dashboard, err := h.service.GetDashboard(userID)
	if err != nil {
		RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toDashboardResponse(dashboard))
}

func (h *DashboardHandler) GetStats(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	rangeParam := c.DefaultQuery("range", "week")

	stats, err := h.service.GetStats(userID, services.StatsRange(rangeParam))
	if err != nil {
		RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"range": rangeParam, "points": stats})
}
