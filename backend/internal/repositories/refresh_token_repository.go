package repositories

import (
	"errors"
	"time"

	"learnmap-backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RefreshTokenRepository struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(token *models.RefreshToken) error {
	return r.db.Create(token).Error
}

// RefreshTokenReuseGrace is how long a just-rotated refresh token still
// works after being superseded. Refresh tokens rotate on every use (a stolen
// token is single-use), but the access token backing it is shared across
// every tab/device the same login is open in — each holds its own in-memory
// copy with its own independent expiry. Without a grace window, two tabs
// whose access tokens happen to expire close together race: the first to
// refresh rotates the cookie, and the second's already-in-flight request
// (carrying the now-superseded token) gets rejected — logging out a
// perfectly legitimate session. See ADR-031.
const RefreshTokenReuseGrace = 30 * time.Second

// GetActiveByHash returns a non-expired token matching the hash that is
// either not yet revoked, or was revoked within RefreshTokenReuseGrace —
// or nil if none exists.
func (r *RefreshTokenRepository) GetActiveByHash(tokenHash string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	err := r.db.Where(
		"token_hash = ? AND expires_at > ? AND (revoked_at IS NULL OR revoked_at > ?)",
		tokenHash, time.Now(), time.Now().Add(-RefreshTokenReuseGrace),
	).First(&token).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *RefreshTokenRepository) Revoke(id uuid.UUID) error {
	return r.db.Model(&models.RefreshToken{}).
		Where("id = ?", id).
		Update("revoked_at", time.Now()).Error
}

func (r *RefreshTokenRepository) RevokeAllForUser(userID uuid.UUID) error {
	return r.db.Model(&models.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", time.Now()).Error
}
