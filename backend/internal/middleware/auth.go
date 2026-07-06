package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const userIDContextKey = "user_id"

// tokenVerifier is satisfied by *services.AuthService without either package
// importing the other's concrete type — middleware stays HTTP-only.
type tokenVerifier interface {
	VerifyAccessToken(tokenString string) (uuid.UUID, error)
}

// Auth requires a valid "Authorization: Bearer <token>" header and injects
// the verified user id into the request context. Every handler for a
// user-owned resource reads user_id via UserIDFromContext — never from the
// URL, query, or body.
func Auth(verifier tokenVerifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": gin.H{
				"code": "UNAUTHORIZED", "message": "missing or malformed Authorization header",
			}})
			return
		}

		tokenString := strings.TrimPrefix(header, "Bearer ")
		userID, err := verifier.VerifyAccessToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": gin.H{
				"code": "UNAUTHORIZED", "message": "invalid or expired access token",
			}})
			return
		}

		c.Set(userIDContextKey, userID)
		c.Next()
	}
}

func UserIDFromContext(c *gin.Context) uuid.UUID {
	return c.MustGet(userIDContextKey).(uuid.UUID)
}
