package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// A fresh user (zero items, zero sessions) must get real JSON arrays, not
// `null`, for every array field — the frontend calls `.length` on these
// unconditionally, and `null.length` crashes the whole page with no error
// boundary to catch it. This reproduces a real bug: buildRecentActivity used
// to declare `var activity []ActivityPoint` (a nil slice) and only append
// inside loops over items/today's sessions, so a brand-new user got
// `recent_activity: null` back.
func TestGetDashboard_FreshUserGetsEmptyArraysNotNull(t *testing.T) {
	router := newTestRouter(t)
	token := registerUser(t, router, "fresh-dashboard@example.com", "Fresh User")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/dashboard", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))

	for _, field := range []string{"weekly_hours_chart", "top_topics", "todays_sessions", "recent_activity"} {
		require.NotEqual(t, "null", string(raw[field]), "%s must not be null for a fresh user", field)

		var asSlice []json.RawMessage
		require.NoError(t, json.Unmarshal(raw[field], &asSlice), "%s must unmarshal as an array", field)
		require.NotNil(t, asSlice, "%s must be a non-nil (possibly empty) array", field)
	}
}
