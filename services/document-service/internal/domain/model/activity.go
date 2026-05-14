package model

import "time"

type ActivityEventEntityType string

type ActivityActionType string

type ActivityEvent struct {
	ID             string
	OrganizationID string
	ActorUserID    string
	ActorUserName  string
	EntityType     ActivityEventEntityType
	EntityID       string
	ActionType     ActivityActionType
	Summary        string
	OccurredAt     time.Time
	DocumentID     *string
	TaskID         *string
	BoardID        *string
}

const (
	ActivityEntityTypeDocument ActivityEventEntityType = "DOCUMENT"
	ActivityEntityTypeTask     ActivityEventEntityType = "TASK"
)

const (
	ActivityActionDocumentCreated       ActivityActionType = "DOCUMENT_CREATED"
	ActivityActionDocumentUpdated       ActivityActionType = "DOCUMENT_UPDATED"
	ActivityActionDocumentSubmitted     ActivityActionType = "DOCUMENT_SUBMITTED"
	ActivityActionDocumentApproved      ActivityActionType = "DOCUMENT_APPROVED"
	ActivityActionExportRequested       ActivityActionType = "EXPORT_REQUESTED"
	ActivityActionExportSucceeded       ActivityActionType = "EXPORT_SUCCEEDED"
	ActivityActionExportFailed          ActivityActionType = "EXPORT_FAILED"
	ActivityActionTaskCreated           ActivityActionType = "TASK_CREATED"
	ActivityActionTaskStatusUpdated     ActivityActionType = "TASK_STATUS_UPDATED"
	ActivityActionTaskAttachmentAdded   ActivityActionType = "TASK_ATTACHMENT_ADDED"
	ActivityActionTaskAttachmentRemoved ActivityActionType = "TASK_ATTACHMENT_REMOVED"
	ActivityActionTaskMemberAdded       ActivityActionType = "TASK_MEMBER_ADDED"
)
