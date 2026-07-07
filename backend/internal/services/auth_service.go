package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"learnmap-backend/internal/apperror"
	"learnmap-backend/internal/models"
	"learnmap-backend/internal/repositories"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// AuthService owns registration, login, token refresh/logout, and access
// token issuance/verification. Nothing outside this file hashes a password
// or signs/verifies a JWT.
type AuthService struct {
	users         *repositories.UserRepository
	refreshTokens *repositories.RefreshTokenRepository
	jwtSecret     []byte
	accessTTL     time.Duration
	refreshTTL    time.Duration
	inviteCode    string
}

func NewAuthService(
	users *repositories.UserRepository,
	refreshTokens *repositories.RefreshTokenRepository,
	jwtSecret string,
	accessTTL time.Duration,
	refreshTTL time.Duration,
	inviteCode string,
) *AuthService {
	return &AuthService{
		users:         users,
		refreshTokens: refreshTokens,
		jwtSecret:     []byte(jwtSecret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
		inviteCode:    inviteCode,
	}
}

type AuthResult struct {
	User *models.User
	// AccessToken is returned to the client in the JSON body.
	AccessToken string
	// RefreshToken is the raw (unhashed) value — the caller must set this as
	// an httpOnly cookie and must never place it in a JSON response body.
	RefreshToken string
}

func (s *AuthService) Register(email, password, displayName, inviteCode string) (*AuthResult, error) {
	if s.inviteCode != "" && inviteCode != s.inviteCode {
		return nil, apperror.Validation("invalid invite code", map[string]string{"invite_code": "invalid"})
	}

	existing, err := s.users.GetByEmail(email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, apperror.Conflict("an account with this email already exists")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Email:        email,
		PasswordHash: string(hash),
		DisplayName:  displayName,
	}
	if err := s.users.Create(user); err != nil {
		return nil, err
	}

	return s.issueTokens(user)
}

func (s *AuthService) Login(email, password string) (*AuthResult, error) {
	user, err := s.users.GetByEmail(email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.Unauthorized("invalid email or password")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, apperror.Unauthorized("invalid email or password")
	}
	return s.issueTokens(user)
}

// Refresh rotates a refresh token: the presented one is revoked and a fresh
// pair is issued. A token already revoked within RefreshTokenReuseGrace is
// still accepted (see that constant's doc comment) but isn't re-revoked —
// its revoked_at stays at the moment of its first use, so the grace window
// expires on schedule rather than resetting on every reuse.
func (s *AuthService) Refresh(rawRefreshToken string) (*AuthResult, error) {
	if rawRefreshToken == "" {
		return nil, apperror.Unauthorized("missing refresh token")
	}

	stored, err := s.refreshTokens.GetActiveByHash(hashToken(rawRefreshToken))
	if err != nil {
		return nil, err
	}
	if stored == nil {
		return nil, apperror.Unauthorized("invalid or expired refresh token")
	}

	user, err := s.users.GetByID(stored.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.Unauthorized("invalid or expired refresh token")
	}

	if stored.RevokedAt == nil {
		if err := s.refreshTokens.Revoke(stored.ID); err != nil {
			return nil, err
		}
	}

	return s.issueTokens(user)
}

// Logout revokes rawRefreshToken only if it belongs to userID — the
// authenticated caller (from the Bearer access token). Without this check, a
// stale or mismatched cookie in the request (e.g. a shared browser/testing
// tool cookie jar) would let a caller revoke a *different* user's session
// merely by being logged in as themselves. Low severity (forced logout at
// worst, no data exposure) but cheap to close off.
func (s *AuthService) Logout(userID uuid.UUID, rawRefreshToken string) error {
	if rawRefreshToken == "" {
		return nil
	}
	stored, err := s.refreshTokens.GetActiveByHash(hashToken(rawRefreshToken))
	if err != nil {
		return err
	}
	if stored == nil || stored.UserID != userID {
		return nil
	}
	return s.refreshTokens.Revoke(stored.ID)
}

func (s *AuthService) GetUser(userID uuid.UUID) (*models.User, error) {
	user, err := s.users.GetByID(userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, apperror.NotFound("user not found")
	}
	return user, nil
}

// VerifyAccessToken parses and validates a JWT access token, returning the embedded user id.
func (s *AuthService) VerifyAccessToken(tokenString string) (uuid.UUID, error) {
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return uuid.Nil, apperror.Unauthorized("invalid or expired access token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, apperror.Unauthorized("invalid access token")
	}
	sub, ok := claims["sub"].(string)
	if !ok {
		return uuid.Nil, apperror.Unauthorized("invalid access token")
	}
	userID, err := uuid.Parse(sub)
	if err != nil {
		return uuid.Nil, apperror.Unauthorized("invalid access token")
	}
	return userID, nil
}

func (s *AuthService) issueTokens(user *models.User) (*AuthResult, error) {
	accessToken, err := s.signAccessToken(user.ID)
	if err != nil {
		return nil, err
	}

	rawRefreshToken, err := generateRandomToken()
	if err != nil {
		return nil, err
	}

	refreshRecord := &models.RefreshToken{
		UserID:    user.ID,
		TokenHash: hashToken(rawRefreshToken),
		ExpiresAt: time.Now().Add(s.refreshTTL),
	}
	if err := s.refreshTokens.Create(refreshRecord); err != nil {
		return nil, err
	}

	return &AuthResult{User: user, AccessToken: accessToken, RefreshToken: rawRefreshToken}, nil
}

func (s *AuthService) signAccessToken(userID uuid.UUID) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"iat": now.Unix(),
		"exp": now.Add(s.accessTTL).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// hashToken hashes a refresh token before storage — the DB only ever holds
// the hash, never the raw value (ADR-010).
func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func generateRandomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
