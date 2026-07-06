package services

import (
	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type ProfileService struct {
	users *repositories.UserRepository
}

func NewProfileService(users *repositories.UserRepository) *ProfileService {
	return &ProfileService{users: users}
}

type UpdateProfileInput struct {
	DisplayName *string
	AvatarURL   *string
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
