package handlers

import (
	"net/http"
	"time"

	"learnmap-backend/internal/middleware"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authService  *services.AuthService
	cookieName   string
	cookieDomain string
	cookieSecure bool
	refreshTTL   time.Duration
}

func NewAuthHandler(authService *services.AuthService, cookieName, cookieDomain string, cookieSecure bool, refreshTTL time.Duration) *AuthHandler {
	return &AuthHandler{
		authService:  authService,
		cookieName:   cookieName,
		cookieDomain: cookieDomain,
		cookieSecure: cookieSecure,
		refreshTTL:   refreshTTL,
	}
}

type registerRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	DisplayName string `json:"display_name" binding:"required"`
	InviteCode  string `json:"invite_code" binding:"required"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type userResponse struct {
	ID          string  `json:"id"`
	Email       string  `json:"email"`
	DisplayName string  `json:"display_name"`
	AvatarURL   *string `json:"avatar_url"`
	CreatedAt   string  `json:"created_at"`
}

type authResponse struct {
	User        userResponse `json:"user"`
	AccessToken string       `json:"access_token"`
}

func toUserResponse(u *models.User) userResponse {
	return userResponse{
		ID:          u.ID.String(),
		Email:       u.Email,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
		CreatedAt:   u.CreatedAt.Format(time.RFC3339),
	}
}

// setRefreshCookie stores the refresh token as an httpOnly cookie — it is
// never returned in a JSON body (ADR-010). SameSite=None is required
// whenever the cookie must be secure (i.e. cross-site in production);
// SameSite=Lax is used for plain-HTTP local dev, where frontend/backend
// share the same registrable domain (localhost) anyway.
func (h *AuthHandler) setRefreshCookie(c *gin.Context, value string) {
	sameSite := http.SameSiteLaxMode
	if h.cookieSecure {
		sameSite = http.SameSiteNoneMode
	}
	c.SetSameSite(sameSite)
	c.SetCookie(h.cookieName, value, int(h.refreshTTL.Seconds()), "/", h.cookieDomain, h.cookieSecure, true)
}

func (h *AuthHandler) clearRefreshCookie(c *gin.Context) {
	sameSite := http.SameSiteLaxMode
	if h.cookieSecure {
		sameSite = http.SameSiteNoneMode
	}
	c.SetSameSite(sameSite)
	c.SetCookie(h.cookieName, "", -1, "/", h.cookieDomain, h.cookieSecure, true)
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	result, err := h.authService.Register(req.Email, req.Password, req.DisplayName, req.InviteCode)
	if err != nil {
		RespondError(c, err)
		return
	}

	h.setRefreshCookie(c, result.RefreshToken)
	c.JSON(http.StatusCreated, authResponse{User: toUserResponse(result.User), AccessToken: result.AccessToken})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondValidationError(c, err)
		return
	}

	result, err := h.authService.Login(req.Email, req.Password)
	if err != nil {
		RespondError(c, err)
		return
	}

	h.setRefreshCookie(c, result.RefreshToken)
	c.JSON(http.StatusOK, authResponse{User: toUserResponse(result.User), AccessToken: result.AccessToken})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	raw, _ := c.Cookie(h.cookieName)

	result, err := h.authService.Refresh(raw)
	if err != nil {
		h.clearRefreshCookie(c)
		RespondError(c, err)
		return
	}

	h.setRefreshCookie(c, result.RefreshToken)
	c.JSON(http.StatusOK, gin.H{"access_token": result.AccessToken})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	raw, _ := c.Cookie(h.cookieName)
	_ = h.authService.Logout(userID, raw)
	h.clearRefreshCookie(c)
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	user, err := h.authService.GetUser(userID)
	if err != nil {
		RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toUserResponse(user))
}
