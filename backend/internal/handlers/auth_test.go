package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func registerAndGetRefreshCookie(t *testing.T, router *gin.Engine, email, displayName string) (accessToken, refreshCookie string) {
	t.Helper()
	body := `{"email":"` + email + `","password":"password123","display_name":"` + displayName + `","invite_code":"` + testInviteCode + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	for _, cookie := range rec.Result().Cookies() {
		if cookie.Name == "refresh_token" {
			refreshCookie = cookie.Value
		}
	}
	require.NotEmpty(t, refreshCookie, "register must set a refresh_token cookie")

	var resp struct {
		AccessToken string `json:"access_token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp.AccessToken, refreshCookie
}

// TestLogout_CannotRevokeAnotherUsersRefreshToken proves the fix: a caller
// authenticated as Bob, but presenting Alice's refresh cookie (the exact
// situation a shared cookie jar — e.g. a testing tool, or a shared browser —
// can produce), must not be able to revoke Alice's session.
func TestLogout_CannotRevokeAnotherUsersRefreshToken(t *testing.T) {
	router := newTestRouter(t)

	_, aliceRefreshCookie := registerAndGetRefreshCookie(t, router, "alice-logout@example.com", "Alice")
	bobToken, _ := registerAndGetRefreshCookie(t, router, "bob-logout@example.com", "Bob")

	// Bob calls logout, authenticated as himself, but with Alice's refresh
	// cookie attached instead of his own.
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	logoutReq.Header.Set("Authorization", "Bearer "+bobToken)
	logoutReq.AddCookie(&http.Cookie{Name: "refresh_token", Value: aliceRefreshCookie})
	logoutRec := httptest.NewRecorder()
	router.ServeHTTP(logoutRec, logoutReq)
	require.Equal(t, http.StatusNoContent, logoutRec.Code)

	// Alice's refresh token must still be valid — Bob's logout call must not
	// have revoked it.
	refreshReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", nil)
	refreshReq.AddCookie(&http.Cookie{Name: "refresh_token", Value: aliceRefreshCookie})
	refreshRec := httptest.NewRecorder()
	router.ServeHTTP(refreshRec, refreshReq)
	require.Equal(t, http.StatusOK, refreshRec.Code, "Alice's own refresh token must survive Bob's logout call: %s", refreshRec.Body.String())
}
