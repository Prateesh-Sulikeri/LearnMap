package handlers

import (
	"net/http"

	"learnmap-backend/internal/middleware"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type ProfileHandler struct {
	service *services.ProfileService
}

func NewProfileHandler(service *services.ProfileService) *ProfileHandler {
	return &ProfileHandler{service: service}
}

type updateProfileRequest struct {
	DisplayName *string `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}

func (h *ProfileHandler) Update(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)

	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	user, err := h.service.UpdateProfile(userID, services.UpdateProfileInput{
		DisplayName: req.DisplayName,
		AvatarURL:   req.AvatarURL,
	})
	if err != nil {
		RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toUserResponse(user))
}

func (h *ProfileHandler) ChangePassword(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)

	var req changePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	if err := h.service.ChangePassword(userID, req.CurrentPassword, req.NewPassword); err != nil {
		RespondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}
