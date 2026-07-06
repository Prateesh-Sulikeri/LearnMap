package handlers_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func registerUser(t *testing.T, router *gin.Engine, email, displayName string) string {
	t.Helper()
	body := fmt.Sprintf(`{"email":%q,"password":"password123","display_name":%q,"invite_code":%q}`, email, displayName, testInviteCode)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var resp struct {
		AccessToken string `json:"access_token"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp.AccessToken
}

func createItem(t *testing.T, router *gin.Engine, token, title string) string {
	t.Helper()
	body := fmt.Sprintf(`{"title":%q}`, title)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/items", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var resp struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp.ID
}

func createSession(t *testing.T, router *gin.Engine, token, itemID string) string {
	t.Helper()
	body := fmt.Sprintf(`{"learning_item_id":%q,"hours":1.5,"session_date":"2026-07-06"}`, itemID)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/sessions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var resp struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp.ID
}

// TestCrossUserIsolation_Items is the mandatory test required by this
// project's testing rules: two distinct users, and proof that one cannot
// read, rename, change the status of, or delete the other's data — not via
// a list endpoint, but by directly guessing/knowing the real resource id.
func TestCrossUserIsolation_Items(t *testing.T) {
	router := newTestRouter(t)

	aliceToken := registerUser(t, router, "alice-iso@example.com", "Alice")
	bobToken := registerUser(t, router, "bob-iso@example.com", "Bob")

	itemID := createItem(t, router, aliceToken, "Alice's private item")

	attacks := []struct {
		name   string
		method string
		path   string
		body   string
	}{
		{"rename", http.MethodPut, "/api/v1/items/" + itemID, `{"title":"pwned"}`},
		{"change status", http.MethodPatch, "/api/v1/items/" + itemID + "/status", `{"status":"completed"}`},
		{"delete", http.MethodDelete, "/api/v1/items/" + itemID, ""},
	}

	for _, attack := range attacks {
		t.Run(attack.name, func(t *testing.T) {
			req := httptest.NewRequest(attack.method, attack.path, strings.NewReader(attack.body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+bobToken)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			require.Equal(t, http.StatusNotFound, rec.Code,
				"Bob must get 404 (never the data, never a distinguishing 403) — got: %s", rec.Body.String())
		})
	}

	// Alice's item must be completely untouched by all of Bob's attempts.
	req := httptest.NewRequest(http.MethodGet, "/api/v1/items", nil)
	req.Header.Set("Authorization", "Bearer "+aliceToken)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	var aliceItems []struct {
		Title  string `json:"title"`
		Status string `json:"status"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &aliceItems))
	require.Len(t, aliceItems, 1)
	require.Equal(t, "Alice's private item", aliceItems[0].Title)
	require.Equal(t, "not_started", aliceItems[0].Status, "Bob's status-change attempt must not have applied")

	// Bob owns nothing — his own list must be empty, not Alice's data.
	req = httptest.NewRequest(http.MethodGet, "/api/v1/items", nil)
	req.Header.Set("Authorization", "Bearer "+bobToken)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	var bobItems []interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &bobItems))
	require.Empty(t, bobItems)
}

func TestCrossUserIsolation_Sessions(t *testing.T) {
	router := newTestRouter(t)

	aliceToken := registerUser(t, router, "alice-sess@example.com", "Alice")
	bobToken := registerUser(t, router, "bob-sess@example.com", "Bob")

	itemID := createItem(t, router, aliceToken, "Kafka")
	sessionID := createSession(t, router, aliceToken, itemID)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/sessions/"+sessionID, nil)
	req.Header.Set("Authorization", "Bearer "+bobToken)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusNotFound, rec.Code, "Bob must not be able to delete Alice's session")

	// Confirm Alice's session survived Bob's attempt.
	req = httptest.NewRequest(http.MethodGet, "/api/v1/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+aliceToken)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	var sessions []interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &sessions))
	require.Len(t, sessions, 1)
}

func TestCrossUserIsolation_Trash(t *testing.T) {
	router := newTestRouter(t)

	aliceToken := registerUser(t, router, "alice-trash@example.com", "Alice")
	bobToken := registerUser(t, router, "bob-trash@example.com", "Bob")

	itemID := createItem(t, router, aliceToken, "Alice's item")

	deleteReq := httptest.NewRequest(http.MethodDelete, "/api/v1/items/"+itemID, nil)
	deleteReq.Header.Set("Authorization", "Bearer "+aliceToken)
	deleteRec := httptest.NewRecorder()
	router.ServeHTTP(deleteRec, deleteReq)
	require.Equal(t, http.StatusOK, deleteRec.Code)

	// Bob's trash must not show Alice's deleted item.
	trashReq := httptest.NewRequest(http.MethodGet, "/api/v1/items/trash", nil)
	trashReq.Header.Set("Authorization", "Bearer "+bobToken)
	trashRec := httptest.NewRecorder()
	router.ServeHTTP(trashRec, trashReq)
	require.Equal(t, http.StatusOK, trashRec.Code)

	var bobTrash []interface{}
	require.NoError(t, json.Unmarshal(trashRec.Body.Bytes(), &bobTrash))
	require.Empty(t, bobTrash, "Bob must not see Alice's deleted items in his trash")

	// Bob must not be able to restore Alice's deleted item by guessing its id.
	restoreReq := httptest.NewRequest(http.MethodPost, "/api/v1/items/"+itemID+"/restore", nil)
	restoreReq.Header.Set("Authorization", "Bearer "+bobToken)
	restoreRec := httptest.NewRecorder()
	router.ServeHTTP(restoreRec, restoreReq)
	require.Equal(t, http.StatusNotFound, restoreRec.Code, "Bob must not be able to restore Alice's deleted item")

	// Confirm Alice's item is still in her own trash, unaffected.
	trashReq = httptest.NewRequest(http.MethodGet, "/api/v1/items/trash", nil)
	trashReq.Header.Set("Authorization", "Bearer "+aliceToken)
	trashRec = httptest.NewRecorder()
	router.ServeHTTP(trashRec, trashReq)
	require.Equal(t, http.StatusOK, trashRec.Code)

	var aliceTrash []struct {
		ID string `json:"id"`
	}
	require.NoError(t, json.Unmarshal(trashRec.Body.Bytes(), &aliceTrash))
	require.Len(t, aliceTrash, 1)
	require.Equal(t, itemID, aliceTrash[0].ID)
}

func TestUnauthenticatedRequestsAreRejected(t *testing.T) {
	router := newTestRouter(t)

	for _, path := range []string{"/api/v1/items", "/api/v1/sessions", "/api/v1/dashboard", "/api/v1/auth/me"} {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			require.Equal(t, http.StatusUnauthorized, rec.Code)
		})
	}
}

func TestRegister_RejectsWrongInviteCode(t *testing.T) {
	router := newTestRouter(t)

	body := `{"email":"eve@example.com","password":"password123","display_name":"Eve","invite_code":"wrong-code"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusBadRequest, rec.Code)
}
