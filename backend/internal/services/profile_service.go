package services

import (
	"regexp"
	"strings"

	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/datatypes"
)

type ProfileService struct {
	users *repositories.UserRepository
}

func NewProfileService(users *repositories.UserRepository) *ProfileService {
	return &ProfileService{users: users}
}

// usernameRegex mirrors GitHub/X-style handles: lowercase letters, digits,
// underscores, hyphens; 3-30 characters; must start with a letter or digit.
var usernameRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{2,29}$`)

type UpdateProfileInput struct {
	DisplayName *string
	AvatarURL   *string
	Username    *string
	Bio         *string
	SocialLinks map[string]string
	IsPublic    *bool
}

func (s *ProfileService) UpdateProfile(userID uuid.UUID, input UpdateProfileInput) (*models.User, error) {
	user, err := s.users.GetByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.NotFound("user not found")
	}

	if input.DisplayName != nil {
		user.DisplayName = *input.DisplayName
	}
	if input.AvatarURL != nil {
		user.AvatarURL = input.AvatarURL
	}
	if input.Bio != nil {
		user.Bio = input.Bio
	}
	if input.IsPublic != nil {
		user.IsPublic = *input.IsPublic
	}
	if input.SocialLinks != nil {
		links := datatypes.JSONMap{}
		for _, platform := range models.SocialPlatforms {
			if url, ok := input.SocialLinks[platform]; ok && url != "" {
				links[platform] = url
			}
		}
		user.SocialLinks = links
	}
	if input.Username != nil {
		normalized := strings.ToLower(strings.TrimSpace(*input.Username))
		if normalized == "" {
			user.Username = nil
		} else {
			if !usernameRegex.MatchString(normalized) {
				return nil, apperror.Validation("invalid username", map[string]string{
					"username": "3-30 characters: lowercase letters, numbers, underscores, hyphens; must start with a letter or number",
				})
			}
			existing, err := s.users.GetByUsername(normalized)
			if err != nil {
				return nil, err
			}
			if existing != nil && existing.ID != userID {
				return nil, apperror.Conflict("that username is already taken")
			}
			user.Username = &normalized
		}
	}

	if err := s.users.Update(user); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *ProfileService) ChangePassword(userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := s.users.GetByID(userID)
	if err != nil {
		return err
	}
	if user == nil {
		return apperror.NotFound("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return apperror.Unauthorized("current password is incorrect")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.PasswordHash = string(hash)
	return s.users.Update(user)
}
