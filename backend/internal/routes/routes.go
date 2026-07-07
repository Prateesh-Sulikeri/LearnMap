package routes

import (
	"learnmap-backend/internal/handlers"
	"learnmap-backend/internal/middleware"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type Dependencies struct {
	AuthService        *services.AuthService
	AuthHandler        *handlers.AuthHandler
	ProfileHandler     *handlers.ProfileHandler
	ItemHandler        *handlers.LearningItemHandler
	SessionHandler     *handlers.StudySessionHandler
	DashboardHandler   *handlers.DashboardHandler
	UploadHandler      *handlers.UploadHandler
	UploadDir          string
	CORSAllowedOrigins []string
}

// Register wires every route. Public auth endpoints (register/login/refresh)
// live outside the Auth middleware group; everything else requires a valid
// bearer token, per the API contract in docs/ARCHITECTURE.md §5.
func Register(router *gin.Engine, deps Dependencies) {
	router.Use(middleware.Recovery())
	router.Use(gin.Logger())
	router.Use(middleware.CORS(deps.CORSAllowedOrigins))

	router.GET("/health", handlers.Health)

	// Public (unauthenticated) static file serving — <img> tags issued by the
	// browser don't carry an Authorization header, so this can't sit behind
	// the auth middleware. Mitigated by unguessable per-file UUID filenames,
	// the same trust model already accepted elsewhere in this pilot-scale MVP.
	router.Static("/uploads", deps.UploadDir)

	api := router.Group("/api/v1")

	auth := api.Group("/auth")
	auth.POST("/register", middleware.RateLimit(10, 5), deps.AuthHandler.Register)
	auth.POST("/login", middleware.RateLimit(10, 5), deps.AuthHandler.Login)
	auth.POST("/refresh", deps.AuthHandler.Refresh)

	protected := api.Group("")
	protected.Use(middleware.Auth(deps.AuthService))
	{
		protected.POST("/auth/logout", deps.AuthHandler.Logout)
		protected.GET("/auth/me", deps.AuthHandler.Me)

		protected.PUT("/profile", deps.ProfileHandler.Update)
		protected.PUT("/profile/password", deps.ProfileHandler.ChangePassword)

		protected.GET("/items", deps.ItemHandler.List)
		protected.POST("/items", deps.ItemHandler.Create)
		protected.GET("/items/trash", deps.ItemHandler.ListTrash)
		protected.PUT("/items/:id", deps.ItemHandler.Update)
		protected.PATCH("/items/:id/status", deps.ItemHandler.SetStatus)
		protected.POST("/items/:id/restore", deps.ItemHandler.Restore)
		protected.DELETE("/items/:id", deps.ItemHandler.Delete)

		protected.GET("/sessions", deps.SessionHandler.List)
		protected.POST("/sessions", deps.SessionHandler.Create)
		protected.DELETE("/sessions/:id", deps.SessionHandler.Delete)

		protected.GET("/dashboard", deps.DashboardHandler.GetDashboard)
		protected.GET("/stats", deps.DashboardHandler.GetStats)

		protected.POST("/uploads", middleware.RateLimit(20, 10), deps.UploadHandler.Upload)
	}
}
