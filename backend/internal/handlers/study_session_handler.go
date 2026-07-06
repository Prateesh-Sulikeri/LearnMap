package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"learnmap-backend/internal/middleware"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type StudySessionHandler struct {
	service *services.StudySessionService
}

func NewStudySessionHandler(service *services.StudySessionService) *StudySessionHandler {
	return &StudySessionHandler{service: service}
}

type createSessionRequest struct {
	LearningItemID string  `json:"learning_item_id" binding:"required"`
	Hours          float64 `json:"hours" binding:"required"`
	Notes          *string `json:"notes"`
	SessionDate    string  `json:"session_date" binding:"required"`
}

type sessionResponse struct {
	ID             string  `json:"id"`
	LearningItemID string  `json:"learning_item_id"`
	Hours          float64 `json:"hours"`
	Notes          *string `json:"notes"`
	SessionDate    string  `json:"session_date"`
	CreatedAt      string  `json:"created_at"`
}

func toSessionResponse(s *models.StudySession) sessionResponse {
	return sessionResponse{
		ID:             s.ID.String(),
		LearningItemID: s.LearningItemID.String(),
		Hours:          s.Hours,
		Notes:          s.Notes,
		SessionDate:    s.SessionDate.Format("2006-01-02"),
		CreatedAt:      s.CreatedAt.Format(time.RFC3339),
	}
}

func (h *StudySessionHandler) List(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)

	filter := repositories.SessionFilter{}
	if itemIDStr := c.Query("item_id"); itemIDStr != "" {
		parsed, err := uuid.Parse(itemIDStr)
		if err != nil {
			RespondValidationError(c, errors.New("item_id must be a valid UUID"))
			return
		}
		filter.LearningItemID = &parsed
	}
	if fromStr := c.Query("from"); fromStr != "" {
		parsed, err := time.Parse("2006-01-02", fromStr)
		if err != nil {
			RespondValidationError(c, errors.New("from must be YYYY-MM-DD"))
			return
		}
		filter.From = &parsed
	}
	if toStr := c.Query("to"); toStr != "" {
		parsed, err := time.Parse("2006-01-02", toStr)
		if err != nil {
			RespondValidationError(c, errors.New("to must be YYYY-MM-DD"))
			return
		}
		filter.To = &parsed
	}
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil {
			filter.Limit = limit
		}
	}
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil {
			filter.Offset = offset
		}
	}

	sessions, err := h.service.List(userID, filter)
	if err != nil {
		RespondError(c, err)
		return
	}
	responses := make([]sessionResponse, 0, len(sessions))
	for i := range sessions {
		responses = append(responses, toSessionResponse(&sessions[i]))
	}
	c.JSON(http.StatusOK, responses)
}

func (h *StudySessionHandler) Create(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)

	var req createSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	itemID, err := uuid.Parse(req.LearningItemID)
	if err != nil {
		RespondValidationError(c, errors.New("learning_item_id must be a valid UUID"))
		return
	}
	sessionDate, err := time.Parse("2006-01-02", req.SessionDate)
	if err != nil {
		RespondValidationError(c, errors.New("session_date must be YYYY-MM-DD"))
		return
	}

	session, svcErr := h.service.Create(userID, services.CreateSessionInput{
		LearningItemID: itemID,
		Hours:          req.Hours,
		Notes:          req.Notes,
		SessionDate:    sessionDate,
	})
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusCreated, toSessionResponse(session))
}

func (h *StudySessionHandler) Delete(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid session id"))
		return
	}

	if svcErr := h.service.Delete(userID, sessionID); svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.Status(http.StatusNoContent)
}
