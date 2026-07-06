// Package apperror defines typed service-layer errors that handlers translate
// into the project's standard JSON error envelope. Services never write to a
// gin.Context; this is how they communicate failure without depending on HTTP.
package apperror

type Code string

const (
	CodeValidation   Code = "VALIDATION_ERROR"
	CodeNotFound     Code = "NOT_FOUND"
	CodeUnauthorized Code = "UNAUTHORIZED"
	CodeConflict     Code = "CONFLICT"
	CodeInternal     Code = "INTERNAL_ERROR"
)

type Error struct {
	Code    Code
	Message string
	Fields  map[string]string
}

func (e *Error) Error() string {
	return e.Message
}

func Validation(message string, fields map[string]string) *Error {
	return &Error{Code: CodeValidation, Message: message, Fields: fields}
}

// NotFound is also the correct response for "exists but belongs to another
// user" (ADR-016) — callers should never distinguish the two cases.
func NotFound(message string) *Error {
	return &Error{Code: CodeNotFound, Message: message}
}

func Unauthorized(message string) *Error {
	return &Error{Code: CodeUnauthorized, Message: message}
}

func Conflict(message string) *Error {
	return &Error{Code: CodeConflict, Message: message}
}
