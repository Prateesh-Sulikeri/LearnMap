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
	LearningItemID string   `json:"learning_item_id" binding:"required"`
	Hours          *float64 `json:"hours"`
	Notes          *string  `json:"notes"`
	SessionDate    *string  `json:"session_date"`
	ScheduledStart *string  `json:"scheduled_start"`
	ScheduledEnd   *string  `json:"scheduled_end"`
}

type confirmSessionRequest struct {
	Hours *float64 `json:"hours"`
	Notes *string  `json:"notes"`
}

type sessionResponse struct {
	ID             string  `json:"id"`
	LearningItemID string  `json:"learning_item_id"`
	Hours          float64 `json:"hours"`
	Notes          *string `json:"notes"`
	SessionDate    string  `json:"session_date"`
	ScheduledStart *string `json:"scheduled_start"`
	ScheduledEnd   *string `json:"scheduled_end"`
	ConfirmedAt    *string `json:"confirmed_at"`
	CreatedAt      string  `json:"created_at"`
}

func toSessionResponse(s *models.StudySession) sessionResponse {
	var scheduledStart, scheduledEnd, confirmedAt *string
	if s.ScheduledStart != nil {
		val := s.ScheduledStart.Format(time.RFC3339)
		scheduledStart = &val
	}
	if s.ScheduledEnd != nil {
		val := s.ScheduledEnd.Format(time.RFC3339)
		scheduledEnd = &val
	}
	if s.ConfirmedAt != nil {
		val := s.ConfirmedAt.Format(time.RFC3339)
		confirmedAt = &val
	}
	return sessionResponse{
		ID:             s.ID.String(),
		LearningItemID: s.LearningItemID.String(),
		Hours:          s.Hours,
		Notes:          s.Notes,
		SessionDate:    s.SessionDate.Format("2006-01-02"),
		ScheduledStart: scheduledStart,
		ScheduledEnd:   scheduledEnd,
		ConfirmedAt:    confirmedAt,
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

	// Two distinct flows share this endpoint, distinguished by session_date:
	//   - "Schedule a session" (future, pending honor-system confirmation):
	//     no session_date, only scheduled_start/scheduled_end.
	//   - "Log a session" (retroactive, already happened): session_date is
	//     given; hours can come directly, or be derived from an optional
	//     scheduled_start/scheduled_end time-of-day pair.
	if req.SessionDate == nil {
		if req.ScheduledStart == nil || req.ScheduledEnd == nil {
			RespondValidationError(c, errors.New("session_date is required, or provide scheduled_start/scheduled_end to schedule a future session"))
			return
		}

		scheduledStart, err := time.Parse(time.RFC3339, *req.ScheduledStart)
		if err != nil {
			RespondValidationError(c, errors.New("scheduled_start must be RFC3339 formatted"))
			return
		}
		scheduledEnd, err := time.Parse(time.RFC3339, *req.ScheduledEnd)
		if err != nil {
			RespondValidationError(c, errors.New("scheduled_end must be RFC3339 formatted"))
			return
		}

		session, svcErr := h.service.CreateScheduled(userID, services.CreateScheduledSessionInput{
			LearningItemID: itemID,
			ScheduledStart: scheduledStart,
			ScheduledEnd:   scheduledEnd,
		})
		if svcErr != nil {
			RespondError(c, svcErr)
			return
		}
		c.JSON(http.StatusCreated, toSessionResponse(session))
		return
	}

	sessionDate, err := time.Parse("2006-01-02", *req.SessionDate)
	if err != nil {
		RespondValidationError(c, errors.New("session_date must be YYYY-MM-DD"))
		return
	}

	var scheduledStart, scheduledEnd *time.Time
	hours := 0.0
	if req.ScheduledStart != nil && req.ScheduledEnd != nil {
		start, err := time.Parse(time.RFC3339, *req.ScheduledStart)
		if err != nil {
			RespondValidationError(c, errors.New("scheduled_start must be RFC3339 formatted"))
			return
		}
		end, err := time.Parse(time.RFC3339, *req.ScheduledEnd)
		if err != nil {
			RespondValidationError(c, errors.New("scheduled_end must be RFC3339 formatted"))
			return
		}
		if !end.After(start) {
			RespondValidationError(c, errors.New("scheduled_end must be after scheduled_start"))
			return
		}
		scheduledStart = &start
		scheduledEnd = &end
		hours = end.Sub(start).Hours()
	} else if req.Hours != nil {
		hours = *req.Hours
	} else {
		RespondValidationError(c, errors.New("either hours or scheduled_start/scheduled_end is required"))
		return
	}

	session, svcErr := h.service.Create(userID, services.CreateSessionInput{
		LearningItemID: itemID,
		Hours:          hours,
		Notes:          req.Notes,
		SessionDate:    sessionDate,
		ScheduledStart: scheduledStart,
		ScheduledEnd:   scheduledEnd,
	})
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusCreated, toSessionResponse(session))
}

func (h *StudySessionHandler) ConfirmScheduled(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	sessionID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid session id"))
		return
	}

	var req confirmSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	session, svcErr := h.service.ConfirmScheduled(userID, sessionID, services.ConfirmScheduledSessionInput{
		Hours: req.Hours,
		Notes: req.Notes,
	})
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, toSessionResponse(session))
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
