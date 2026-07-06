package handlers

import (
	"errors"
	"net/http"

	"learnmap-backend/internal/apperror"

	"github.com/gin-gonic/gin"
)

// RespondError translates a service-layer error into the project's standard
// JSON error envelope. Any error that isn't a recognized *apperror.Error is
// treated as an unexpected internal failure (500) — never leaked to the client.
func RespondError(c *gin.Context, err error) {
	var appErr *apperror.Error
	if errors.As(err, &appErr) {
		c.JSON(statusForCode(appErr.Code), gin.H{"error": gin.H{
			"code":    appErr.Code,
			"message": appErr.Message,
			"fields":  appErr.Fields,
		}})
		return
	}

	c.JSON(http.StatusInternalServerError, gin.H{"error": gin.H{
		"code":    apperror.CodeInternal,
		"message": "internal server error",
	}})
}

func RespondValidationError(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{"error": gin.H{
		"code":    apperror.CodeValidation,
		"message": err.Error(),
	}})
}

func statusForCode(code apperror.Code) int {
	switch code {
	case apperror.CodeValidation:
		return http.StatusBadRequest
	case apperror.CodeNotFound:
		return http.StatusNotFound
	case apperror.CodeUnauthorized:
		return http.StatusUnauthorized
	case apperror.CodeConflict:
		return http.StatusConflict
	default:
		return http.StatusInternalServerError
	}
}
