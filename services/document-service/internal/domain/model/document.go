package model

import (
	"fmt"
	"time"
)

type DocumentStatus string

const (
	DocumentStatusDraft            DocumentStatus = "DRAFT"
	DocumentStatusInReview         DocumentStatus = "IN_REVIEW"
	DocumentStatusChangesRequested DocumentStatus = "CHANGES_REQUESTED"
	DocumentStatusApproved         DocumentStatus = "APPROVED"
	DocumentStatusArchived         DocumentStatus = "ARCHIVED"
)

var (
	ErrDocumentNotFound        = fmt.Errorf("document not found")
	ErrDocumentNotEditable     = fmt.Errorf("document is not editable")
	ErrDocumentAccessDenied    = fmt.Errorf("document access denied")
	ErrWorkflowNotFound        = fmt.Errorf("document workflow not found")
	ErrWorkflowCommentRequired = fmt.Errorf("workflow decision comment is required")
	ErrWorkflowVersionRequired = fmt.Errorf("workflow expected version must be positive")
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

type InvalidDocumentStatusTransitionError struct {
	Current DocumentStatus
	Target  DocumentStatus
}

func NewInvalidDocumentStatusTransitionError(current DocumentStatus, target DocumentStatus) InvalidDocumentStatusTransitionError {
	return InvalidDocumentStatusTransitionError{Current: current, Target: target}
}

func (e InvalidDocumentStatusTransitionError) Error() string {
	return fmt.Sprintf("invalid document status transition: current=%s target=%s", e.Current, e.Target)
}

func (s DocumentStatus) IsEditable() bool {
	return s == DocumentStatusDraft || s == DocumentStatusChangesRequested
}

type Document struct {
	ID              string
	Title           string
	Category        string
	OrganizationID  string
	Status          DocumentStatus
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
	Status          DocumentStatus
	ChangedByUserID string
	ChangeSummary   string
	CreatedAt       string
	ObjectKey       string
	ObjectVersionID string
	ContentDocument map[string]any
}

type WorkflowInstance struct {
	ID                string
	DocumentID        string
	OrganizationID    string
	SubmittedVersion  int64
	Status            DocumentStatus
	SubmittedByUserID string
	ApproverUserID    string
	DecisionComment   string
	SubmittedAt       time.Time
	DecidedAt         *time.Time
	UpdatedAt         time.Time
}

type WorkflowEvent struct {
	ID              string
	WorkflowID      string
	DocumentID      string
	ActorUserID     string
	EventType       string
	PreviousStatus  DocumentStatus
	NewStatus       DocumentStatus
	DocumentVersion int64
	Comment         string
	OccurredAt      time.Time
}
