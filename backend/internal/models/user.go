package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// Known social platform keys accepted in SocialLinks — not enforced by the
// schema (a plain JSONB map so adding a new platform later never needs a
// migration), but validated against this list in the service layer.
var SocialPlatforms = []string{"linkedin", "instagram", "github", "portfolio", "x", "leetcode"}

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email        string    `gorm:"uniqueIndex;not null"`
	PasswordHash string    `gorm:"not null"`
	DisplayName  string    `gorm:"not null"`
	AvatarURL    *string
	// Username is nullable — a user has no public profile URL until they
	// choose one, even though IsPublic defaults to true.
	Username    *string `gorm:"uniqueIndex"`
	Bio         *string
	SocialLinks datatypes.JSONMap `gorm:"not null;default:'{}'"`
	IsPublic    bool              `gorm:"not null;default:true"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (User) TableName() string {
	return "users"
}
