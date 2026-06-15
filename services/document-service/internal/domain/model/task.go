package model

import (
	"errors"
	"time"
)

type TaskStatus string

type TaskType string

type TaskDecision string

type TaskBoardRole string

type TaskAttachment struct {
	ID         string
	TaskID     string
	DocumentID string
	Title      string
	Category   string
	Status     string
	CreatedAt  time.Time
}

type AvailableTaskDocument struct {
	DocumentID string
	Title      string
	Category   string
	UpdatedAt  time.Time
	Version    int64
}

type Task struct {
	ID                string
	BoardID           string
	DocumentID        string
	TaskType          TaskType
	Title             string
	Description       string
	Status            TaskStatus
	AssignedUserID    string
	AssignedUserName  string
	CreatedByUserID   string
	CreatedByUserName string
	ApproverUserID    *string
	ApproverUserName  *string
	Decision          *TaskDecision
	DecisionComment   *string
	DueDate           *time.Time
	Priority          int
	Metadata          map[string]interface{}
	Attachments       []TaskAttachment
	CreatedAt         time.Time
	UpdatedAt         time.Time
	UpdatedByUserID   *string
	UpdatedByUserName *string
}

type TaskBoardSummary struct {
	ID             string
	OrganizationID string
	Name           string
	Description    string
	MembersCount   int
	TasksCount     int
}

type TaskBoard struct {
	ID              string
	OrganizationID  string
	Name            string
	Description     string
	CreatedByUserID string
	Members         []TaskBoardMember
}

type TaskBoardMember struct {
	UserID     string
	FullName   string
	Department string
	Email      string
	BoardRole  TaskBoardRole
	Roles      []string
}

type TaskActor struct {
	UserID               string
	FullName             string
	OrganizationID       string
	Roles                []string
	BoardRole            TaskBoardRole
	IsOrganizationMember bool
	IsBoardMember        bool
}

type TaskCapabilities struct {
	CanEdit         bool
	CanAssign       bool
	CanMoveToReview bool
	CanApprove      bool
	CanComment      bool
}

type TaskAssignmentAuthorizer interface {
	CanAssign(actor TaskActor, task Task) bool
}

type TaskAssignmentResult struct {
	Task               Task
	Actor              TaskActor
	PreviousAssigneeID string
}

type TaskStatusUpdate struct {
	ExpectedStatus    TaskStatus
	Status            TaskStatus
	Decision          *TaskDecision
	DecisionComment   *string
	UpdatedByUserID   string
	UpdatedByUserName string
}

type TaskBoardDetails struct {
	ID              string
	OrganizationID  string
	Name            string
	Description     string
	AllowedGrouping []string
	Members         []TaskBoardMember
	Tasks           []Task
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

	TaskBoardRoleOwner   TaskBoardRole = "OWNER"
	TaskBoardRoleManager TaskBoardRole = "MANAGER"
	TaskBoardRoleMember  TaskBoardRole = "MEMBER"
)

var (
	ErrTaskNotFound                = errors.New("task not found")
	ErrTaskBoardNotFound           = errors.New("task board not found")
	ErrTaskMemberNotFound          = errors.New("organization member not found")
	ErrTaskAssigneeNotBoardMember  = errors.New("task assignee is not an active board member")
	ErrTaskAssignmentForbidden     = errors.New("task assignment forbidden")
	ErrTaskStatusConflict          = errors.New("task status changed concurrently")
	ErrAttachmentDocumentForbidden = errors.New("attachment document access forbidden")
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

func ParseTaskBoardRole(value string) (TaskBoardRole, error) {
	switch TaskBoardRole(value) {
	case TaskBoardRoleOwner:
		return TaskBoardRoleOwner, nil
	case TaskBoardRoleManager:
		return TaskBoardRoleManager, nil
	case TaskBoardRoleMember, "":
		return TaskBoardRoleMember, nil
	default:
		return "", errors.New("invalid task board role")
	}
}

func (a TaskActor) HasRole(role string) bool {
	for _, actorRole := range a.Roles {
		if actorRole == role {
			return true
		}
	}
	return false
}
