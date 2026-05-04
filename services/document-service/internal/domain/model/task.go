package model

import (
	"errors"
	"time"
)

type TaskStatus string

type TaskType string

type TaskDecision string

type TaskAttachment struct {
	ID                 string
	TaskID             string
	FileName           string
	FilePath           string
	FileSize           int64
	MimeType           string
	UploadedByUserID   string
	UploadedByUserName string
	UploadedAt         time.Time
}

type Task struct {
	ID                string
	DocumentID        string
	TaskType          TaskType
	Title             string
	Description       string
	Status            TaskStatus
	AssignedUserID    string
	AssignedUserName  string
	CreatedByUserID   string
	CreatedByUserName string
	DueDate           *time.Time
	Priority          int
	Metadata          map[string]interface{}
	CreatedAt         time.Time
	UpdatedAt         time.Time
	UpdatedByUserID   *string
	UpdatedByUserName *string
}

const (
	TaskStatusPending  TaskStatus = "PENDING"
	TaskStatusInReview TaskStatus = "IN_REVIEW"
	TaskStatusApproved TaskStatus = "APPROVED"
	TaskStatusDeclined TaskStatus = "DECLINED"

	TaskTypeApproval TaskType = "approval"
	TaskTypeGeneral  TaskType = "general"

	TaskDecisionApproved TaskDecision = "approved"
	TaskDecisionDeclined TaskDecision = "declined"
)

var (
	ErrTaskNotFound = errors.New("task not found")
)

func (s TaskStatus) IsFinal() bool {
	return s == TaskStatusApproved || s == TaskStatusDeclined
}

func (s TaskStatus) CanAdvanceToReview() bool {
	return s == TaskStatusPending
}

func (t TaskType) IsApproval() bool {
	return t == TaskTypeApproval
}
