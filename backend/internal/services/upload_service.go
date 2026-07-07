package services

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"learnmap-backend/internal/apperror"

	"github.com/google/uuid"
)

// SVG is deliberately excluded even though it's colloquially "an image" — it
// can carry embedded <script>/event-handler payloads, and this whitelist is
// the only thing standing between arbitrary uploaded bytes and a browser
// treating the response as a same-origin-adjacent resource.
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// UploadService stores user-uploaded images (for embedding in notes) on
// local disk. This is a known MVP simplification — local disk doesn't
// survive a redeploy on an ephemeral-filesystem host, so this must move to
// persistent object storage (e.g. S3-compatible) before any production
// deploy where the backend isn't on a host with a persistent volume.
type UploadService struct {
	uploadDir    string
	maxSizeBytes int64
}

func NewUploadService(uploadDir string, maxSizeMB int) *UploadService {
	return &UploadService{uploadDir: uploadDir, maxSizeBytes: int64(maxSizeMB) * 1024 * 1024}
}

// MaxSizeBytes lets the handler cap the request body before parsing it, as
// defense-in-depth on top of the post-parse size check in SaveImage.
func (s *UploadService) MaxSizeBytes() int64 {
	return s.maxSizeBytes
}

// SaveImage validates and persists an uploaded image, returning the URL path
// it will be served from. The content-type is sniffed from the actual bytes
// (not trusted from the client-supplied header, which is trivially spoofable)
// and the stored filename is always server-generated, never the client's.
func (s *UploadService) SaveImage(userID uuid.UUID, file io.Reader, size int64) (string, error) {
	if size > s.maxSizeBytes {
		return "", apperror.Validation("file too large", map[string]string{
			"file": fmt.Sprintf("must be under %d MB", s.maxSizeBytes/(1024*1024)),
		})
	}

	buf := make([]byte, 512)
	n, err := io.ReadFull(file, buf)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		return "", err
	}
	buf = buf[:n]

	contentType := http.DetectContentType(buf)
	ext, ok := allowedImageTypes[contentType]
	if !ok {
		return "", apperror.Validation("unsupported file type", map[string]string{
			"file": "must be a JPEG, PNG, GIF, or WebP image",
		})
	}

	userDir := filepath.Join(s.uploadDir, userID.String())
	if err := os.MkdirAll(userDir, 0o755); err != nil {
		return "", err
	}

	filename := uuid.New().String() + ext
	fullPath := filepath.Join(userDir, filename)

	out, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := out.Write(buf); err != nil {
		return "", err
	}
	if _, err := io.Copy(out, file); err != nil {
		return "", err
	}

	return fmt.Sprintf("/uploads/%s/%s", userID.String(), filename), nil
}
