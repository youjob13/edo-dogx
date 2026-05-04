package outbound

import (
	"context"

	"edo/services/document-service/internal/domain/model"
)

type TaskRepository interface {
	CreateTask(ctx context.Context, task model.Task) (model.Task, error)
	UpdateTaskStatus(ctx context.Context, taskID string, newStatus model.TaskStatus, updatedByUserID string, updatedByUserName string) error
	GetTask(ctx context.Context, taskID string) (model.Task, error)
	ListTasks(ctx context.Context, filter TaskFilter) ([]model.Task, error)
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
