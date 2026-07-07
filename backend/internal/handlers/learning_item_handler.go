package handlers

import (
	"errors"
	"net/http"
	"time"

	"learnmap-backend/internal/middleware"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type LearningItemHandler struct {
	service *services.LearningItemService
}

func NewLearningItemHandler(service *services.LearningItemService) *LearningItemHandler {
	return &LearningItemHandler{service: service}
}

type createItemRequest struct {
	ParentID    *string `json:"parent_id"`
	Title       string  `json:"title" binding:"required"`
	Description *string `json:"description"`
	Deadline    *string `json:"deadline"`
}

type updateItemRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Deadline    *string `json:"deadline"`
}

type setStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

type setFavoriteRequest struct {
	Favorite bool `json:"favorite"`
}

type itemResponse struct {
	ID          string  `json:"id"`
	ParentID    *string `json:"parent_id"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
	Deadline    *string `json:"deadline"`
	Position    int     `json:"position"`
	IsFavorite  bool    `json:"is_favorite"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
	CompletedAt *string `json:"completed_at"`
}

func toItemResponse(item *models.LearningItem) itemResponse {
	var parentID *string
	if item.ParentID != nil {
		s := item.ParentID.String()
		parentID = &s
	}
	var deadline *string
	if item.Deadline != nil {
		s := item.Deadline.Format(time.RFC3339)
		deadline = &s
	}
	var completedAt *string
	if item.CompletedAt != nil {
		s := item.CompletedAt.Format(time.RFC3339)
		completedAt = &s
	}
	return itemResponse{
		ID:          item.ID.String(),
		ParentID:    parentID,
		Title:       item.Title,
		Description: item.Description,
		Status:      string(item.Status),
		Deadline:    deadline,
		Position:    item.Position,
		IsFavorite:  item.IsFavorite,
		CreatedAt:   item.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   item.UpdatedAt.Format(time.RFC3339),
		CompletedAt: completedAt,
	}
}

func (h *LearningItemHandler) List(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	items, err := h.service.List(userID)
	if err != nil {
		RespondError(c, err)
		return
	}
	responses := make([]itemResponse, 0, len(items))
	for i := range items {
		responses = append(responses, toItemResponse(&items[i]))
	}
	c.JSON(http.StatusOK, responses)
}

func (h *LearningItemHandler) Create(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)

	var req createItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	input := services.CreateItemInput{Title: req.Title, Description: req.Description}
	if req.ParentID != nil {
		parsed, err := uuid.Parse(*req.ParentID)
		if err != nil {
			RespondValidationError(c, errors.New("parent_id must be a valid UUID"))
			return
		}
		input.ParentID = &parsed
	}
	if req.Deadline != nil {
		parsed, err := time.Parse(time.RFC3339, *req.Deadline)
		if err != nil {
			RespondValidationError(c, errors.New("deadline must be an RFC3339 timestamp"))
			return
		}
		input.Deadline = &parsed
	}

	item, err := h.service.Create(userID, input)
	if err != nil {
		RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, toItemResponse(item))
}

func (h *LearningItemHandler) Update(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid item id"))
		return
	}

	var req updateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	input := services.UpdateItemInput{Title: req.Title, Description: req.Description}
	if req.Deadline != nil {
		parsed, err := time.Parse(time.RFC3339, *req.Deadline)
		if err != nil {
			RespondValidationError(c, errors.New("deadline must be an RFC3339 timestamp"))
			return
		}
		input.Deadline = &parsed
	}

	item, svcErr := h.service.Update(userID, itemID, input)
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, toItemResponse(item))
}

func (h *LearningItemHandler) SetStatus(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid item id"))
		return
	}

	var req setStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	item, svcErr := h.service.SetStatus(userID, itemID, models.LearningItemStatus(req.Status))
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, toItemResponse(item))
}

func (h *LearningItemHandler) SetFavorite(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid item id"))
		return
	}

	var req setFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	item, svcErr := h.service.SetFavorite(userID, itemID, req.Favorite)
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, toItemResponse(item))
}

func (h *LearningItemHandler) Delete(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid item id"))
		return
	}

	count, svcErr := h.service.Delete(userID, itemID)
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted_count": count})
}

type trashedItemResponse struct {
	ID          string  `json:"id"`
	ParentID    *string `json:"parent_id"`
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
	DeletedAt   string  `json:"deleted_at"`
}

func toTrashedItemResponse(item *models.LearningItem) trashedItemResponse {
	var parentID *string
	if item.ParentID != nil {
		s := item.ParentID.String()
		parentID = &s
	}
	return trashedItemResponse{
		ID:          item.ID.String(),
		ParentID:    parentID,
		Title:       item.Title,
		Description: item.Description,
		Status:      string(item.Status),
		DeletedAt:   item.DeletedAt.Time.Format(time.RFC3339),
	}
}

func (h *LearningItemHandler) ListTrash(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	items, err := h.service.ListTrash(userID)
	if err != nil {
		RespondError(c, err)
		return
	}
	responses := make([]trashedItemResponse, 0, len(items))
	for i := range items {
		responses = append(responses, toTrashedItemResponse(&items[i]))
	}
	c.JSON(http.StatusOK, responses)
}

func (h *LearningItemHandler) Restore(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid item id"))
		return
	}

	count, svcErr := h.service.Restore(userID, itemID)
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"restored_count": count})
}

// DeletePermanently hard-deletes a single trash item (and its already
// soft-deleted descendants) — no recovery possible afterward.
func (h *LearningItemHandler) DeletePermanently(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondValidationError(c, errors.New("invalid item id"))
		return
	}

	count, svcErr := h.service.DeletePermanently(userID, itemID)
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted_count": count})
}

// EmptyTrash hard-deletes every currently-trashed item for the user — no
// recovery possible afterward.
func (h *LearningItemHandler) EmptyTrash(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	count, err := h.service.EmptyTrash(userID)
	if err != nil {
		RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted_count": count})
}
