package main

import (
	"log"
	"os"

	"learnmap-backend/internal/config"
	"learnmap-backend/internal/database"
	"learnmap-backend/internal/handlers"
	"learnmap-backend/internal/repositories"
	"learnmap-backend/internal/routes"
	"learnmap-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load() // fine if .env is absent, e.g. in production where env vars are set directly

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	if err := database.Migrate(cfg.DatabaseURL, "migrations"); err != nil {
		log.Fatalf("migration error: %v", err)
	}
	log.Println("migrations applied")

	if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
		log.Fatalf("upload dir error: %v", err)
	}

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connection error: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	itemRepo := repositories.NewLearningItemRepository(db)
	sessionRepo := repositories.NewStudySessionRepository(db)
	eventRepo := repositories.NewEventRepository(db)

	eventService := services.NewEventService(eventRepo)
	authService := services.NewAuthService(userRepo, refreshTokenRepo, cfg.JWTSecret, cfg.AccessTokenTTL, cfg.RefreshTokenTTL, cfg.InviteCode)
	profileService := services.NewProfileService(userRepo)
	itemService := services.NewLearningItemService(itemRepo, eventService)
	sessionService := services.NewStudySessionService(sessionRepo, itemRepo, eventService)
	dashboardService := services.NewDashboardService(sessionRepo, itemRepo)
	publicProfileService := services.NewPublicProfileService(userRepo, sessionRepo)
	uploadService := services.NewUploadService(cfg.UploadDir, cfg.MaxUploadSizeMB)

	authHandler := handlers.NewAuthHandler(authService, cfg.RefreshCookieName, cfg.RefreshCookieDomain, cfg.RefreshCookieSecure, cfg.RefreshTokenTTL)
	profileHandler := handlers.NewProfileHandler(profileService)
	itemHandler := handlers.NewLearningItemHandler(itemService)
	sessionHandler := handlers.NewStudySessionHandler(sessionService)
	dashboardHandler := handlers.NewDashboardHandler(dashboardService)
	publicProfileHandler := handlers.NewPublicProfileHandler(publicProfileService)
	uploadHandler := handlers.NewUploadHandler(uploadService)

	router := gin.New()
	routes.Register(router, routes.Dependencies{
		AuthService:          authService,
		AuthHandler:          authHandler,
		ProfileHandler:       profileHandler,
		ItemHandler:          itemHandler,
		SessionHandler:       sessionHandler,
		DashboardHandler:     dashboardHandler,
		PublicProfileHandler: publicProfileHandler,
		UploadHandler:        uploadHandler,
		UploadDir:            cfg.UploadDir,
		CORSAllowedOrigins:   cfg.CORSAllowedOrigins,
	})

	log.Printf("listening on :%s", cfg.Port)
	if err := router.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
