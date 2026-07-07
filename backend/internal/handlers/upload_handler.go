package handlers

import (
	"net/http"

	"learnmap-backend/internal/middleware"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type UploadHandler struct {
	service *services.UploadService
}

func NewUploadHandler(service *services.UploadService) *UploadHandler {
	return &UploadHandler{service: service}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)

	// Defense-in-depth on top of SaveImage's own size check: cap the request
	// body before it's even parsed, so an oversized upload can't consume
	// memory/disk during multipart parsing itself.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.service.MaxSizeBytes()+1<<20)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		RespondValidationError(c, err)
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		RespondError(c, err)
		return
	}
	defer file.Close()

	url, svcErr := h.service.SaveImage(userID, file, fileHeader.Size)
	if svcErr != nil {
		RespondError(c, svcErr)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"url": url})
}
