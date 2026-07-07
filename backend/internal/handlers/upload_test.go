package handlers_test

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

// A valid 1x1 transparent PNG, base64-encoded — a minimal real image fixture.
const tinyPNGBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func newMultipartUpload(t *testing.T, fieldName, filename string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile(fieldName, filename)
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	return body, writer.FormDataContentType()
}

func TestUpload_ValidImage(t *testing.T) {
	router := newTestRouter(t)
	token := registerUser(t, router, "uploader@example.com", "Uploader")

	png, err := base64.StdEncoding.DecodeString(tinyPNGBase64)
	require.NoError(t, err)

	body, contentType := newMultipartUpload(t, "file", "avatar.png", png)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	var resp struct {
		URL string `json:"url"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	require.Contains(t, resp.URL, "/uploads/")
	require.Contains(t, resp.URL, ".png")

	// Confirm it's actually retrievable via the static route.
	getReq := httptest.NewRequest(http.MethodGet, resp.URL, nil)
	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)
	require.Equal(t, http.StatusOK, getRec.Code)
}

func TestUpload_RejectsNonImage(t *testing.T) {
	router := newTestRouter(t)
	token := registerUser(t, router, "uploader-text@example.com", "Uploader")

	body, contentType := newMultipartUpload(t, "file", "notes.txt", []byte("just some text, not an image"))
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpload_RejectsSVG(t *testing.T) {
	router := newTestRouter(t)
	token := registerUser(t, router, "uploader-svg@example.com", "Uploader")

	// SVG is deliberately excluded from the whitelist — it can carry
	// embedded <script>/event-handler payloads.
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)
	body, contentType := newMultipartUpload(t, "file", "image.svg", svg)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpload_RejectsOversizedFile(t *testing.T) {
	router := newTestRouter(t)
	token := registerUser(t, router, "uploader-big@example.com", "Uploader")

	// The test router configures a 5MB limit; send something reported larger.
	oversized := make([]byte, 6*1024*1024)
	body, contentType := newMultipartUpload(t, "file", "big.png", oversized)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", body)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestUpload_RequiresAuth(t *testing.T) {
	router := newTestRouter(t)

	png, err := base64.StdEncoding.DecodeString(tinyPNGBase64)
	require.NoError(t, err)
	body, contentType := newMultipartUpload(t, "file", "avatar.png", png)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", body)
	req.Header.Set("Content-Type", contentType)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.Equal(t, http.StatusUnauthorized, rec.Code)
}
