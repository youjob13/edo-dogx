package outbound

import (
	"context"

	"edo/services/document-service/internal/domain/model"
)

type TaskRepository interface {
	CreateTaskBoard(ctx context.Context, board model.TaskBoard) (model.TaskBoardSummary, error)
	GetTaskBoard(ctx context.Context, boardID string) (model.TaskBoardDetails, error)
	CreateTask(ctx context.Context, task model.Task) (model.Task, error)
	UpdateTaskStatus(ctx context.Context, taskID string, newStatus model.TaskStatus, updatedByUserID string, updatedByUserName string) error
	GetTask(ctx context.Context, taskID string) (model.Task, error)
	ListTasks(ctx context.Context, filter TaskFilter) ([]model.Task, error)
	ListTaskBoards(ctx context.Context, filter TaskBoardFilter) ([]model.TaskBoardSummary, int, error)
	ListOrganizationMembers(ctx context.Context, organizationID string, limit int, offset int) ([]model.TaskBoardMember, int, error)
	AddTaskBoardMember(ctx context.Context, boardID string, userID string) (model.TaskBoardMember, error)
	AddTaskAttachments(ctx context.Context, taskID string, attachments []model.TaskAttachment) error
	GetTaskAttachments(ctx context.Context, taskID string) ([]model.TaskAttachment, error)
}

type TaskFilter struct {
	DocumentID     *string
	AssignedUserID *string
	Status         *model.TaskStatus
	TaskType       *model.TaskType
	Limit          *int
}

type TaskBoardFilter struct {
	OrganizationID *string
	Limit          *int
	Offset         *int
}
