package outbound

import (
	"context"

	"edo/services/document-service/internal/domain/model"
)

type TaskRepository interface {
	CreateTaskBoard(ctx context.Context, board model.TaskBoard) (model.TaskBoardSummary, error)
	GetTaskBoard(ctx context.Context, boardID string) (model.TaskBoardDetails, error)
	CreateTask(ctx context.Context, task model.Task) (model.Task, error)
	CreateTaskWithAttachments(ctx context.Context, task model.Task, actorUserID string, documentIDs []string) (model.Task, error)
	UpdateTaskStatus(ctx context.Context, taskID string, update model.TaskStatusUpdate) error
	UpdateTaskAssignee(
		ctx context.Context,
		taskID string,
		actorUserID string,
		assigneeUserID string,
		authorizer model.TaskAssignmentAuthorizer,
	) (model.TaskAssignmentResult, error)
	GetTask(ctx context.Context, taskID string) (model.Task, error)
	ListTasks(ctx context.Context, filter TaskFilter) ([]model.Task, error)
	ListTaskBoards(ctx context.Context, filter TaskBoardFilter) ([]model.TaskBoardSummary, int, error)
	ListTaskBoardMembers(ctx context.Context, boardID string) ([]model.TaskBoardMember, error)
	ListOrganizationMembers(ctx context.Context, organizationID string, limit int, offset int) ([]model.TaskBoardMember, int, error)
	AddTaskBoardMember(ctx context.Context, boardID string, userID string, role model.TaskBoardRole) (model.TaskBoardMember, error)
	CreateOrganizationMember(ctx context.Context, organizationID string, member model.TaskBoardMember) (bool, error)
	GetOrganizationActor(ctx context.Context, organizationID string, userID string) (model.TaskActor, error)
	GetBoardActor(ctx context.Context, boardID string, userID string) (model.TaskActor, error)
	AddTaskAttachments(ctx context.Context, taskID string, attachments []model.TaskAttachment) error
	RemoveTaskAttachment(ctx context.Context, taskID string, documentID string) error
	GetTaskAttachments(ctx context.Context, taskID string) ([]model.TaskAttachment, error)
	GetAvailableApprovers(ctx context.Context, boardID string, search string, limit int) ([]model.TaskBoardMember, int, error)
	GetAvailableDocuments(ctx context.Context, boardID string, category string, search string, limit int) ([]model.AvailableTaskDocument, int, error)
}

type TaskFilter struct {
	ActorUserID    *string
	DocumentID     *string
	AssignedUserID *string
	ParticipantUserID *string
	Status         *model.TaskStatus
	TaskType       *model.TaskType
	Limit          *int
}

type TaskBoardFilter struct {
	OrganizationID *string
	ActorUserID    *string
	Limit          *int
	Offset         *int
}
