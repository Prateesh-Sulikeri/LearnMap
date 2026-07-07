package handlers

import (
	"net/http"
	"time"

	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type PublicProfileHandler struct {
	service *services.PublicProfileService
}

func NewPublicProfileHandler(service *services.PublicProfileService) *PublicProfileHandler {
	return &PublicProfileHandler{service: service}
}

type publicProfileResponse struct {
	DisplayName   string                     `json:"display_name"`
	AvatarURL     *string                    `json:"avatar_url"`
	Bio           *string                    `json:"bio"`
	SocialLinks   map[string]string          `json:"social_links"`
	JoinedAt      string                     `json:"joined_at"`
	CurrentStreak int                        `json:"current_streak"`
	Heatmap       []services.DailyHoursPoint `json:"heatmap"`
}

func (h *PublicProfileHandler) GetByUsername(c *gin.Context) {
	username := c.Param("username")

	profile, err := h.service.GetByUsername(username)
	if err != nil {
		RespondError(c, err)
		return
	}

	c.JSON(http.StatusOK, publicProfileResponse{
		DisplayName:   profile.DisplayName,
		AvatarURL:     profile.AvatarURL,
		Bio:           profile.Bio,
		SocialLinks:   socialLinksToMap(profile.SocialLinks),
		JoinedAt:      profile.JoinedAt.Format(time.RFC3339),
		CurrentStreak: profile.CurrentStreak,
		Heatmap:       profile.Heatmap,
	})
}
