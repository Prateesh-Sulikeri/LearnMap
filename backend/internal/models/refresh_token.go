package models

import (
	"time"

	"github.com/google/uuid"
)

// RefreshToken stores only a hash of the token value — never the plaintext
// token itself — so a database leak doesn't equal instant session takeover.
type RefreshToken struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	TokenHash string    `gorm:"not null;index"`
	ExpiresAt time.Time `gorm:"not null"`
	CreatedAt time.Time
	RevokedAt *time.Time
}

func (RefreshToken) TableName() string {
	return "refresh_tokens"
}
