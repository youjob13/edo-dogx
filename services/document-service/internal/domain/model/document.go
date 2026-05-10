package model

import "fmt"

type DocumentStatus string

const (
	DocumentStatusDraft    DocumentStatus = "DRAFT"
	DocumentStatusInReview DocumentStatus = "IN_REVIEW"
	DocumentStatusApproved DocumentStatus = "APPROVED"
	DocumentStatusArchived DocumentStatus = "ARCHIVED"
)

var (
	ErrDocumentNotFound    = fmt.Errorf("document not found")
	ErrDocumentNotEditable = fmt.Errorf("document is not editable")
)

type VersionConflictError struct {
	Expected int64
	Current  int64
}

func NewVersionConflictError(expected int64, current int64) VersionConflictError {
	return VersionConflictError{Expected: expected, Current: current}
}

func (e VersionConflictError) Error() string {
	return fmt.Sprintf("document version conflict: expected=%d current=%d", e.Expected, e.Current)
}

func (s DocumentStatus) IsEditable() bool {
	return s == DocumentStatusDraft
}

type Document struct {
	ID              string
	Title           string
	Category        string
	ContentDocument map[string]any
	OwnerUser       string
	OwnerUserName   string
	Version         int64
	UpdatedAt       string
	CreatedAt       string
	ObjectKey       string
	ObjectVersionID string
}

type DocumentVersion struct {
	DocumentID      string
	VersionNumber   int64
	Title           string
	Category        string
	ChangedByUserID string
	ChangeSummary   string
	CreatedAt       string
	ObjectKey       string
	ObjectVersionID string
	ContentDocument map[string]any
}
