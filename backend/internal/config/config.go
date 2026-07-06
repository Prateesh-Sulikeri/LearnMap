package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port                string
	DatabaseURL         string
	JWTSecret           string
	AccessTokenTTL      time.Duration
	RefreshTokenTTL     time.Duration
	CORSAllowedOrigins  []string
	InviteCode          string
	RefreshCookieName   string
	RefreshCookieDomain string
	RefreshCookieSecure bool
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:                getEnv("PORT", "8080"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		InviteCode:          os.Getenv("INVITE_CODE"),
		RefreshCookieName:   getEnv("REFRESH_COOKIE_NAME", "refresh_token"),
		RefreshCookieDomain: os.Getenv("REFRESH_COOKIE_DOMAIN"),
		RefreshCookieSecure: getEnv("REFRESH_COOKIE_SECURE", "true") == "true",
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	accessTTLMin, err := strconv.Atoi(getEnv("ACCESS_TOKEN_TTL_MINUTES", "15"))
	if err != nil {
		return nil, fmt.Errorf("invalid ACCESS_TOKEN_TTL_MINUTES: %w", err)
	}
	cfg.AccessTokenTTL = time.Duration(accessTTLMin) * time.Minute

	refreshTTLDays, err := strconv.Atoi(getEnv("REFRESH_TOKEN_TTL_DAYS", "30"))
	if err != nil {
		return nil, fmt.Errorf("invalid REFRESH_TOKEN_TTL_DAYS: %w", err)
	}
	cfg.RefreshTokenTTL = time.Duration(refreshTTLDays) * 24 * time.Hour

	origins := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
	for _, o := range strings.Split(origins, ",") {
		cfg.CORSAllowedOrigins = append(cfg.CORSAllowedOrigins, strings.TrimSpace(o))
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
