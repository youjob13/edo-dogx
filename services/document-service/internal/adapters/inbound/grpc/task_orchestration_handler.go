package grpcadapter

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"edo/services/document-service/internal/adapters/inbound/grpc/pb"
	appservice "edo/services/document-service/internal/application/service"
	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type TaskOrchestrationHandler struct {
	pb.UnimplementedTaskOrchestrationServiceServer
	taskRepository outbound.TaskRepository
	activity       *appservice.ActivityService
	syncer         ProjectionSyncer
	authorization  *appservice.TaskAuthorizationPolicy
	notifier       TaskAssignmentNotifier
}

func NewTaskOrchestrationHandler(
	taskRepository outbound.TaskRepository,
	activity *appservice.ActivityService,
	syncer ProjectionSyncer,
	notifier TaskAssignmentNotifier,
) *TaskOrchestrationHandler {
	return &TaskOrchestrationHandler{
		taskRepository: taskRepository,
		activity:       activity,
		syncer:         syncer,
		authorization:  appservice.NewTaskAuthorizationPolicy(),
		notifier:       notifier,
	}
}

func (h *TaskOrchestrationHandler) Register(server *grpc.Server) {
	pb.RegisterTaskOrchestrationServiceServer(server, h)
}

func (h *TaskOrchestrationHandler) CreateTaskBoard(ctx context.Context, req *pb.CreateTaskBoardRequest) (*pb.CreateTaskBoardResponse, error) {
	if req.GetActorUserId() == "" || req.GetOrganizationId() == "" || req.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "actor_user_id, organization_id, and name are required")
	}

	actor, err := h.taskRepository.GetOrganizationActor(ctx, req.GetOrganizationId(), req.GetActorUserId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanCreateBoard(actor) {
		return nil, status.Error(codes.PermissionDenied, "organization membership is required")
	}

	board, err := h.taskRepository.CreateTaskBoard(ctx, model.TaskBoard{
		OrganizationID:  req.GetOrganizationId(),
		Name:            req.GetName(),
		Description:     req.GetDescription(),
		CreatedByUserID: req.GetActorUserId(),
	})
	if err != nil {
		if err == model.ErrTaskMemberNotFound {
			return nil, status.Error(codes.FailedPrecondition, "board creator is not an organization member")
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.CreateTaskBoardResponse{
		Board: &pb.TaskBoardSummary{
			Id:             board.ID,
			OrganizationId: board.OrganizationID,
			Name:           board.Name,
			Description:    board.Description,
			MembersCount:   int32(board.MembersCount),
			TasksCount:     int32(board.TasksCount),
		},
	}, nil
}

func (h *TaskOrchestrationHandler) GetTaskBoard(ctx context.Context, req *pb.GetTaskBoardRequest) (*pb.GetTaskBoardResponse, error) {
	if req.GetBoardId() == "" {
		return nil, status.Error(codes.InvalidArgument, "board_id is required")
	}
	if req.GetActorUserId() == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}

	actor, err := h.taskRepository.GetBoardActor(ctx, req.GetBoardId(), req.GetActorUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanReadBoard(actor) {
		return nil, status.Error(codes.PermissionDenied, "board access denied")
	}

	board, err := h.taskRepository.GetTaskBoard(ctx, req.GetBoardId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	members := make([]*pb.BoardMember, 0, len(board.Members))
	for _, member := range board.Members {
		members = append(members, &pb.BoardMember{
			Id:         member.UserID,
			FullName:   member.FullName,
			Department: member.Department,
			Email:      member.Email,
			BoardRole:  string(member.BoardRole),
			Roles:      member.Roles,
		})
	}

	tasks := make([]*pb.Task, 0, len(board.Tasks))
	for _, task := range board.Tasks {
		tasks = append(tasks, mapTaskToProto(task))
	}
	availableApprovers, _, err := h.taskRepository.GetAvailableApprovers(ctx, board.ID, "", 200)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	approverItems := make([]*pb.BoardMember, 0, len(availableApprovers))
	for _, approver := range availableApprovers {
		approverItems = append(approverItems, mapBoardMemberToProto(approver))
	}

	return &pb.GetTaskBoardResponse{
		Board: &pb.TaskBoard{
			Id:                 board.ID,
			Name:               board.Name,
			Members:            members,
			Tasks:              tasks,
			AvailableApprovers: approverItems,
			OrganizationId:     board.OrganizationID,
			Description:        board.Description,
			AllowedGrouping:    board.AllowedGrouping,
		},
	}, nil
}

func (h *TaskOrchestrationHandler) ListTaskBoards(ctx context.Context, req *pb.ListTaskBoardsRequest) (*pb.ListTaskBoardsResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}

	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	offset := int(req.GetOffset())
	if offset < 0 {
		offset = 0
	}

	var organizationID *string
	if req.GetOrganizationId() != "" {
		id := req.GetOrganizationId()
		organizationID = &id
	}
	actorUserID := req.GetActorUserId()

	boards, total, err := h.taskRepository.ListTaskBoards(ctx, outbound.TaskBoardFilter{
		OrganizationID: organizationID,
		ActorUserID:    &actorUserID,
		Limit:          &limit,
		Offset:         &offset,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*pb.TaskBoardSummary, 0, len(boards))
	for _, board := range boards {
		items = append(items, &pb.TaskBoardSummary{
			Id:             board.ID,
			OrganizationId: board.OrganizationID,
			Name:           board.Name,
			Description:    board.Description,
			MembersCount:   int32(board.MembersCount),
			TasksCount:     int32(board.TasksCount),
		})
	}

	page := int32(0)
	if limit > 0 {
		page = int32(offset / limit)
	}

	return &pb.ListTaskBoardsResponse{Boards: items, Total: int32(total), Page: page, PageSize: int32(limit)}, nil
}

func (h *TaskOrchestrationHandler) CreateTask(ctx context.Context, req *pb.CreateTaskRequest) (*pb.CreateTaskResponse, error) {
	if req.GetActorUserId() == "" {
		return nil, status.Error(codes.InvalidArgument, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetTitle()) == "" {
		return nil, status.Error(codes.InvalidArgument, "title is required")
	}
	if strings.TrimSpace(req.GetBoardId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "board_id is required")
	}
	if strings.TrimSpace(req.GetAssigneeUserId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "assignee_user_id is required")
	}

	actor, err := h.taskRepository.GetBoardActor(ctx, req.GetBoardId(), req.GetActorUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanCreateTask(actor) {
		return nil, status.Error(codes.PermissionDenied, "task creation denied")
	}
	if req.GetAssigneeUserId() != req.GetActorUserId() {
		placeholderTask := model.Task{CreatedByUserID: req.GetActorUserId()}
		if !h.authorization.Capabilities(actor, placeholderTask).CanAssign {
			return nil, status.Error(codes.PermissionDenied, "task assignment denied")
		}
	}
	assignee, err := h.taskRepository.GetBoardActor(ctx, req.GetBoardId(), req.GetAssigneeUserId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !assignee.IsBoardMember {
		return nil, status.Error(codes.InvalidArgument, "assignee must be a board member")
	}
	if strings.TrimSpace(req.GetApproverUserId()) != "" {
		approver, err := h.taskRepository.GetBoardActor(ctx, req.GetBoardId(), req.GetApproverUserId())
		if err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
		if !approver.IsBoardMember {
			return nil, status.Error(codes.InvalidArgument, "approver must be a board member")
		}
		if !approver.HasRole("edms.approver") && !approver.HasRole("edms.admin") {
			return nil, status.Error(codes.InvalidArgument, "approver must hold edms.approver role")
		}
	}

	taskType := model.TaskType(req.GetTaskType())
	if taskType == "" {
		taskType = model.TaskTypeGeneral
	}
	if taskType != model.TaskTypeGeneral && taskType != model.TaskTypeApproval {
		return nil, status.Error(codes.InvalidArgument, "task_type must be 'general' or 'approval'")
	}
	if taskType == model.TaskTypeApproval && strings.TrimSpace(req.GetApproverUserId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "approver_user_id is required for approval tasks")
	}
	if taskType == model.TaskTypeApproval &&
		req.GetAssigneeUserId() == req.GetApproverUserId() &&
		!actor.HasRole("edms.admin") {
		return nil, status.Error(codes.FailedPrecondition, "assignee and approver must be different users")
	}

	var dueDate *time.Time
	if req.GetDueDate() != "" {
		parsed, err := time.Parse(time.RFC3339, req.GetDueDate())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "due_date must be RFC3339")
		}
		dueDate = &parsed
	}

	var approverUserID *string
	if strings.TrimSpace(req.GetApproverUserId()) != "" {
		id := strings.TrimSpace(req.GetApproverUserId())
		approverUserID = &id
	}

	createdTask, err := h.taskRepository.CreateTaskWithAttachments(ctx, model.Task{
		BoardID:           req.GetBoardId(),
		Title:             strings.TrimSpace(req.GetTitle()),
		Description:       strings.TrimSpace(req.GetDescription()),
		Status:            model.TaskStatusPending,
		TaskType:          taskType,
		CreatedByUserID:   req.GetActorUserId(),
		CreatedByUserName: "",
		AssignedUserID:    req.GetAssigneeUserId(),
		AssignedUserName:  "",
		ApproverUserID:    approverUserID,
		ApproverUserName:  approverUserID,
		DueDate:           dueDate,
	}, req.GetActorUserId(), req.GetAttachmentDocumentIds())
	if err != nil {
		if err == model.ErrAttachmentDocumentForbidden {
			return nil, status.Error(codes.PermissionDenied, "one or more documents are inaccessible")
		}
		if err == model.ErrTaskMemberNotFound {
			return nil, status.Error(codes.InvalidArgument, "creator, assignee, or approver is not an organization member")
		}
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	h.syncProjectionAsync(createdTask.ID, "TASK")
	h.recordTaskActivityAsync(model.ActivityEvent{
		OrganizationID: actor.OrganizationID,
		ActorUserID:    req.GetActorUserId(),
		ActorUserName:  actor.FullName,
		EntityType:     model.ActivityEntityTypeTask,
		EntityID:       createdTask.ID,
		ActionType:     model.ActivityActionTaskCreated,
		Summary:        "Создана задача: " + createdTask.Title,
		TaskID:         &createdTask.ID,
		BoardID:        &createdTask.BoardID,
	}, createdTask)

	return &pb.CreateTaskResponse{Task: mapTaskToProto(createdTask)}, nil
}

func (h *TaskOrchestrationHandler) ListTasks(ctx context.Context, req *pb.ListTasksRequest) (*pb.ListTasksResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}

	filter := outbound.TaskFilter{ActorUserID: stringPointer(req.GetActorUserId())}
	if value := strings.TrimSpace(req.GetAssigneeUserId()); value != "" {
		filter.AssignedUserID = &value
	}
	if value := strings.TrimSpace(req.GetStatus()); value != "" {
		taskStatus, err := parseStatus(value)
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, err.Error())
		}
		filter.Status = &taskStatus
	}
	if value := strings.TrimSpace(req.GetTaskType()); value != "" {
		taskType := model.TaskType(value)
		if taskType != model.TaskTypeGeneral && taskType != model.TaskTypeApproval {
			return nil, status.Error(codes.InvalidArgument, "task_type must be 'general' or 'approval'")
		}
		filter.TaskType = &taskType
	}
	if req.GetLimit() > 0 {
		limit := min(int(req.GetLimit()), 200)
		filter.Limit = &limit
	}

	tasks, err := h.taskRepository.ListTasks(ctx, filter)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	items := make([]*pb.Task, 0, len(tasks))
	for _, task := range tasks {
		items = append(items, mapTaskToProto(task))
	}
	return &pb.ListTasksResponse{Tasks: items}, nil
}

func (h *TaskOrchestrationHandler) UpdateTaskStatus(ctx context.Context, req *pb.UpdateTaskStatusRequest) (*pb.UpdateTaskStatusResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetTaskId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "task_id is required")
	}
	if strings.TrimSpace(req.GetStatus()) == "" {
		return nil, status.Error(codes.InvalidArgument, "status is required")
	}

	task, err := h.taskRepository.GetTask(ctx, req.GetTaskId())
	if err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	nextStatus, err := parseStatus(req.GetStatus())
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	if !isValidTransition(task.Status, nextStatus) {
		return nil, status.Error(codes.FailedPrecondition, "invalid task status transition")
	}

	statusUpdate, err := buildTaskStatusUpdate(task, nextStatus, req)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}

	actor, err := h.taskRepository.GetBoardActor(ctx, task.BoardID, req.GetActorUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	capabilities := h.authorization.Capabilities(actor, task)
	allowed := false
	switch nextStatus {
	case model.TaskStatusInReview:
		allowed = capabilities.CanMoveToReview
	case model.TaskStatusApproved, model.TaskStatusDeclined:
		allowed = capabilities.CanApprove
	case model.TaskStatusPending:
		allowed = h.authorization.CanMoveToPending(actor, task)
	}
	if !allowed {
		return nil, status.Error(codes.PermissionDenied, "task status transition denied")
	}

	statusUpdate.UpdatedByUserID = req.GetActorUserId()
	statusUpdate.UpdatedByUserName = actor.FullName
	if err := h.taskRepository.UpdateTaskStatus(ctx, req.GetTaskId(), statusUpdate); err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		if err == model.ErrTaskStatusConflict {
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	task, err = h.taskRepository.GetTask(ctx, req.GetTaskId())
	if err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	h.syncProjectionAsync(task.ID, "TASK")
	h.recordTaskActivityAsync(model.ActivityEvent{
		OrganizationID: actor.OrganizationID,
		ActorUserID:    req.GetActorUserId(),
		ActorUserName:  actor.FullName,
		EntityType:     model.ActivityEntityTypeTask,
		EntityID:       task.ID,
		ActionType:     model.ActivityActionTaskStatusUpdated,
		Summary:        "Обновлен статус задачи: " + task.Title,
		TaskID:         &task.ID,
		BoardID:        &task.BoardID,
	}, task)

	return &pb.UpdateTaskStatusResponse{Task: mapTaskToProto(task)}, nil
}

func (h *TaskOrchestrationHandler) UpdateTaskAssignee(ctx context.Context, req *pb.UpdateTaskAssigneeRequest) (*pb.UpdateTaskAssigneeResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetTaskId()) == "" || strings.TrimSpace(req.GetAssigneeUserId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "task_id and assignee_user_id are required")
	}

	result, err := h.taskRepository.UpdateTaskAssignee(
		ctx,
		strings.TrimSpace(req.GetTaskId()),
		strings.TrimSpace(req.GetActorUserId()),
		strings.TrimSpace(req.GetAssigneeUserId()),
		h.authorization,
	)
	if err != nil {
		switch err {
		case model.ErrTaskNotFound:
			return nil, status.Error(codes.NotFound, err.Error())
		case model.ErrTaskAssignmentForbidden:
			return nil, status.Error(codes.PermissionDenied, err.Error())
		case model.ErrTaskAssigneeNotBoardMember:
			return nil, status.Error(codes.InvalidArgument, err.Error())
		default:
			return nil, status.Error(codes.Internal, err.Error())
		}
	}

	task := result.Task
	h.syncProjectionAsync(task.ID, "TASK")
	h.recordTaskActivityAsync(model.ActivityEvent{
		OrganizationID: result.Actor.OrganizationID,
		ActorUserID:    result.Actor.UserID,
		ActorUserName:  result.Actor.FullName,
		EntityType:     model.ActivityEntityTypeTask,
		EntityID:       task.ID,
		ActionType:     model.ActivityActionTaskAssigneeUpdated,
		Summary:        "Изменен исполнитель задачи: " + task.Title,
		Metadata: map[string]interface{}{
			"previousAssigneeId": result.PreviousAssigneeID,
			"newAssigneeId":      task.AssignedUserID,
		},
		TaskID:  &task.ID,
		BoardID: &task.BoardID,
	}, task)
	h.notifyTaskAssignmentAsync(result)

	return &pb.UpdateTaskAssigneeResponse{Task: mapTaskToProto(task)}, nil
}

func (h *TaskOrchestrationHandler) AddTaskAttachments(ctx context.Context, req *pb.AddTaskAttachmentsRequest) (*pb.AddTaskAttachmentsResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetTaskId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "task_id is required")
	}
	if len(req.GetAttachments()) == 0 {
		return nil, status.Error(codes.InvalidArgument, "attachments are required")
	}

	task, err := h.taskRepository.GetTask(ctx, req.GetTaskId())
	if err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	actor, err := h.taskRepository.GetBoardActor(ctx, task.BoardID, req.GetActorUserId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanMutateAttachments(actor, task) {
		return nil, status.Error(codes.PermissionDenied, "task attachment update denied")
	}

	attachments := make([]model.TaskAttachment, 0, len(req.GetAttachments()))
	for _, item := range req.GetAttachments() {
		attachments = append(attachments, model.TaskAttachment{
			TaskID:     req.GetTaskId(),
			DocumentID: item.GetDocumentId(),
			Title:      item.GetTitle(),
			Category:   item.GetCategory(),
			Status:     "DRAFT",
		})
	}

	if err := h.taskRepository.AddTaskAttachments(ctx, req.GetTaskId(), attachments); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	persisted, err := h.taskRepository.GetTaskAttachments(ctx, req.GetTaskId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if task, err := h.taskRepository.GetTask(ctx, req.GetTaskId()); err == nil {
		h.recordTaskActivityAsync(model.ActivityEvent{
			OrganizationID: actor.OrganizationID,
			ActorUserID:    req.GetActorUserId(),
			ActorUserName:  actor.FullName,
			EntityType:     model.ActivityEntityTypeTask,
			EntityID:       task.ID,
			ActionType:     model.ActivityActionTaskAttachmentAdded,
			Summary:        "Добавлены вложения к задаче: " + task.Title,
			TaskID:         &task.ID,
			BoardID:        &task.BoardID,
		}, task)
	}

	return &pb.AddTaskAttachmentsResponse{Attachments: mapAttachmentsToProto(persisted)}, nil
}

func (h *TaskOrchestrationHandler) RemoveTaskAttachment(ctx context.Context, req *pb.RemoveTaskAttachmentRequest) (*pb.Task, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetTaskId()) == "" || strings.TrimSpace(req.GetDocumentId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "task_id and document_id are required")
	}

	task, err := h.taskRepository.GetTask(ctx, req.GetTaskId())
	if err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	actor, err := h.taskRepository.GetBoardActor(ctx, task.BoardID, req.GetActorUserId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanMutateAttachments(actor, task) {
		return nil, status.Error(codes.PermissionDenied, "task attachment update denied")
	}

	if err := h.taskRepository.RemoveTaskAttachment(ctx, req.GetTaskId(), req.GetDocumentId()); err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	task, err = h.taskRepository.GetTask(ctx, req.GetTaskId())
	if err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	h.recordTaskActivityAsync(model.ActivityEvent{
		OrganizationID: actor.OrganizationID,
		ActorUserID:    req.GetActorUserId(),
		ActorUserName:  actor.FullName,
		EntityType:     model.ActivityEntityTypeTask,
		EntityID:       task.ID,
		ActionType:     model.ActivityActionTaskAttachmentRemoved,
		Summary:        "Удалено вложение из задачи: " + task.Title,
		TaskID:         &task.ID,
		BoardID:        &task.BoardID,
	}, task)

	return mapTaskToProto(task), nil
}

func (h *TaskOrchestrationHandler) GetTaskDetails(ctx context.Context, req *pb.GetTaskDetailsRequest) (*pb.GetTaskDetailsResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetTaskId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "task_id is required")
	}

	task, err := h.taskRepository.GetTask(ctx, req.GetTaskId())
	if err != nil {
		if err == model.ErrTaskNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	actor, err := h.taskRepository.GetBoardActor(ctx, task.BoardID, req.GetActorUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanReadTask(actor, task) {
		return nil, status.Error(codes.PermissionDenied, "task access denied")
	}
	memberItems := make([]*pb.BoardMember, 0)
	if h.authorization.CanReadBoard(actor) {
		members, err := h.taskRepository.ListTaskBoardMembers(ctx, task.BoardID)
		if err != nil {
			return nil, status.Error(codes.Internal, err.Error())
		}
		memberItems = make([]*pb.BoardMember, 0, len(members))
		for _, member := range members {
			memberItems = append(memberItems, mapBoardMemberToProto(member))
		}
	}
	capabilities := h.authorization.Capabilities(actor, task)

	return &pb.GetTaskDetailsResponse{
		Task:            mapTaskToProto(task),
		Members:         memberItems,
		CurrentUserId:   req.GetActorUserId(),
		CanEdit:         capabilities.CanEdit,
		CanAssign:       capabilities.CanAssign,
		CanMoveToReview: capabilities.CanMoveToReview,
		CanApprove:      capabilities.CanApprove,
		CanComment:      capabilities.CanComment,
	}, nil
}

func (h *TaskOrchestrationHandler) GetAvailableApprovers(ctx context.Context, req *pb.AvailableApproversRequest) (*pb.AvailableApproversResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetBoardId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "board_id is required")
	}
	actor, err := h.taskRepository.GetBoardActor(ctx, req.GetBoardId(), req.GetActorUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanReadBoard(actor) {
		return nil, status.Error(codes.PermissionDenied, "board access denied")
	}

	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	items, total, err := h.taskRepository.GetAvailableApprovers(ctx, req.GetBoardId(), req.GetSearch(), limit)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	result := make([]*pb.BoardMember, 0, len(items))
	for _, item := range items {
		result = append(result, &pb.BoardMember{
			Id:         item.UserID,
			FullName:   item.FullName,
			Department: item.Department,
			Email:      item.Email,
			BoardRole:  string(item.BoardRole),
			Roles:      item.Roles,
		})
	}

	return &pb.AvailableApproversResponse{Items: result, Total: int32(total)}, nil
}

func (h *TaskOrchestrationHandler) GetAvailableDocuments(ctx context.Context, req *pb.AvailableDocumentsRequest) (*pb.AvailableDocumentsResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetBoardId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "board_id is required")
	}
	actor, err := h.taskRepository.GetBoardActor(ctx, req.GetBoardId(), req.GetActorUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanReadBoard(actor) {
		return nil, status.Error(codes.PermissionDenied, "board access denied")
	}

	statusFilter := strings.TrimSpace(strings.ToLower(req.GetStatus()))
	if statusFilter != "" && statusFilter != "published" {
		return nil, status.Error(codes.InvalidArgument, "status must be empty or 'published'")
	}

	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	items, total, err := h.taskRepository.GetAvailableDocuments(ctx, req.GetBoardId(), req.GetCategory(), req.GetSearch(), limit)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	result := make([]*pb.DocumentItem, 0, len(items))
	for _, item := range items {
		result = append(result, &pb.DocumentItem{
			Id:        item.DocumentID,
			Title:     item.Title,
			Category:  item.Category,
			UpdatedAt: item.UpdatedAt.Format(time.RFC3339),
			SizeKb:    0,
			Version:   int32(item.Version),
		})
	}

	return &pb.AvailableDocumentsResponse{Items: result, Total: int32(total)}, nil
}

func (h *TaskOrchestrationHandler) ListOrganizationMembers(ctx context.Context, req *pb.ListOrganizationMembersRequest) (*pb.ListOrganizationMembersResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetOrganizationId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "organization_id is required")
	}
	actor, err := h.taskRepository.GetOrganizationActor(ctx, req.GetOrganizationId(), req.GetActorUserId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !actor.IsOrganizationMember {
		return nil, status.Error(codes.PermissionDenied, "organization access denied")
	}

	limit := int(req.GetLimit())
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := int(req.GetOffset())
	if offset < 0 {
		offset = 0
	}

	members, total, err := h.taskRepository.ListOrganizationMembers(ctx, req.GetOrganizationId(), limit, offset)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	items := make([]*pb.BoardMember, 0, len(members))
	for _, member := range members {
		items = append(items, mapBoardMemberToProto(member))
	}

	return &pb.ListOrganizationMembersResponse{Items: items, Total: int32(total)}, nil
}

func (h *TaskOrchestrationHandler) AddTaskBoardMember(ctx context.Context, req *pb.AddTaskBoardMemberRequest) (*pb.AddTaskBoardMemberResponse, error) {
	if strings.TrimSpace(req.GetActorUserId()) == "" {
		return nil, status.Error(codes.Unauthenticated, "actor_user_id is required")
	}
	if strings.TrimSpace(req.GetBoardId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "board_id is required")
	}
	if strings.TrimSpace(req.GetUserId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	actor, err := h.taskRepository.GetBoardActor(ctx, req.GetBoardId(), req.GetActorUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	if !h.authorization.CanManageBoardMembers(actor) {
		return nil, status.Error(codes.PermissionDenied, "board member management denied")
	}

	boardRole, err := model.ParseTaskBoardRole(strings.ToUpper(strings.TrimSpace(req.GetRole())))
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, "role must be OWNER, MANAGER, or MEMBER")
	}
	if boardRole == model.TaskBoardRoleOwner &&
		!actor.HasRole("edms.admin") &&
		actor.BoardRole != model.TaskBoardRoleOwner {
		return nil, status.Error(codes.PermissionDenied, "only board owners can grant owner role")
	}

	member, err := h.taskRepository.AddTaskBoardMember(ctx, req.GetBoardId(), req.GetUserId(), boardRole)
	if err != nil {
		if err == model.ErrTaskBoardNotFound || err == model.ErrTaskMemberNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	h.recordBoardMemberEventAsync(
		actor.OrganizationID,
		req.GetActorUserId(),
		actor.FullName,
		req.GetBoardId(),
		member.UserID,
		member.FullName,
	)

	return &pb.AddTaskBoardMemberResponse{Member: mapBoardMemberToProto(member)}, nil
}

func (h *TaskOrchestrationHandler) CreateOrganizationMember(ctx context.Context, req *pb.CreateOrganizationMemberRequest) (*pb.CreateOrganizationMemberResponse, error) {
	if strings.TrimSpace(req.GetOrganizationId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "organization_id is required")
	}
	if strings.TrimSpace(req.GetUserId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}
	if req.GetActorUserId() != req.GetUserId() {
		return nil, status.Error(codes.PermissionDenied, "organization member provisioning must be self-scoped")
	}
	member := model.TaskBoardMember{
		UserID:     strings.TrimSpace(req.GetUserId()),
		FullName:   strings.TrimSpace(req.GetFullName()),
		Department: strings.TrimSpace(req.GetDepartment()),
		Email:      strings.TrimSpace(req.GetEmail()),
		Roles:      req.GetRoles(),
	}
	created, err := h.taskRepository.CreateOrganizationMember(ctx, strings.TrimSpace(req.GetOrganizationId()), member)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.CreateOrganizationMemberResponse{Member: mapBoardMemberToProto(member), Created: created}, nil
}

func mapBoardMemberToProto(member model.TaskBoardMember) *pb.BoardMember {
	return &pb.BoardMember{
		Id:         member.UserID,
		FullName:   member.FullName,
		Department: member.Department,
		Email:      member.Email,
		BoardRole:  string(member.BoardRole),
		Roles:      member.Roles,
	}
}

func mapTaskToProto(task model.Task) *pb.Task {
	item := &pb.Task{
		Id:               task.ID,
		Title:            task.Title,
		Description:      task.Description,
		Status:           strings.ToLower(string(task.Status)),
		TaskType:         string(task.TaskType),
		CreatorUserId:    task.CreatedByUserID,
		CreatorUserName:  task.CreatedByUserName,
		AssigneeUserId:   task.AssignedUserID,
		AssigneeUserName: task.AssignedUserName,
		Attachments:      mapAttachmentsToProto(task.Attachments),
		CreatedAt:        task.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        task.UpdatedAt.Format(time.RFC3339),
	}

	if task.ApproverUserID != nil {
		item.ApproverUserId = *task.ApproverUserID
	}
	if task.ApproverUserName != nil {
		item.ApproverUserName = *task.ApproverUserName
	}
	if task.Decision != nil {
		item.Decision = string(*task.Decision)
	}
	if task.DecisionComment != nil {
		item.DecisionComment = *task.DecisionComment
	}
	if task.DueDate != nil {
		item.DueDate = task.DueDate.Format(time.RFC3339)
	}

	return item
}

func mapAttachmentsToProto(attachments []model.TaskAttachment) []*pb.TaskAttachment {
	items := make([]*pb.TaskAttachment, 0, len(attachments))
	for _, attachment := range attachments {
		items = append(items, &pb.TaskAttachment{DocumentId: attachment.DocumentID, Title: attachment.Title, Category: attachment.Category})
	}
	return items
}

func parseStatus(raw string) (model.TaskStatus, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "pending":
		return model.TaskStatusPending, nil
	case "in_review":
		return model.TaskStatusInReview, nil
	case "approved":
		return model.TaskStatusApproved, nil
	case "declined":
		return model.TaskStatusDeclined, nil
	default:
		return "", fmt.Errorf("status must be one of: pending, in_review, approved, declined")
	}
}

func stringPointer(value string) *string {
	return &value
}

func isValidTransition(from model.TaskStatus, to model.TaskStatus) bool {
	switch from {
	case model.TaskStatusPending:
		return to == model.TaskStatusInReview
	case model.TaskStatusInReview:
		return to == model.TaskStatusPending || to == model.TaskStatusApproved || to == model.TaskStatusDeclined
	case model.TaskStatusApproved, model.TaskStatusDeclined:
		return false
	default:
		return false
	}
}

func buildTaskStatusUpdate(
	task model.Task,
	nextStatus model.TaskStatus,
	req *pb.UpdateTaskStatusRequest,
) (model.TaskStatusUpdate, error) {
	update := model.TaskStatusUpdate{
		ExpectedStatus: task.Status,
		Status:         nextStatus,
	}
	decision := strings.ToLower(strings.TrimSpace(req.GetDecision()))
	comment := strings.TrimSpace(req.GetDecisionComment())

	switch nextStatus {
	case model.TaskStatusApproved:
		if !task.TaskType.IsApproval() || task.Status != model.TaskStatusInReview {
			return model.TaskStatusUpdate{}, errors.New("only approval tasks in review can be approved")
		}
		if decision != string(model.TaskDecisionApproved) {
			return model.TaskStatusUpdate{}, errors.New("decision must be 'approved'")
		}
		value := model.TaskDecisionApproved
		update.Decision = &value
		if comment != "" {
			update.DecisionComment = &comment
		}
	case model.TaskStatusDeclined:
		if !task.TaskType.IsApproval() || task.Status != model.TaskStatusInReview {
			return model.TaskStatusUpdate{}, errors.New("only approval tasks in review can be declined")
		}
		if decision != string(model.TaskDecisionDeclined) {
			return model.TaskStatusUpdate{}, errors.New("decision must be 'declined'")
		}
		if comment == "" {
			return model.TaskStatusUpdate{}, errors.New("decision_comment is required when declining a task")
		}
		value := model.TaskDecisionDeclined
		update.Decision = &value
		update.DecisionComment = &comment
	default:
		if decision != "" || comment != "" {
			return model.TaskStatusUpdate{}, errors.New("decision fields are only allowed for approval or decline")
		}
	}

	return update, nil
}

func (h *TaskOrchestrationHandler) syncProjectionAsync(entityID string, entityType string) {
	if h.syncer == nil || strings.TrimSpace(entityID) == "" {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = h.syncer.Sync(ctx, entityType, entityID, false)
	}()
}

func (h *TaskOrchestrationHandler) recordTaskActivityAsync(event model.ActivityEvent, task model.Task) {
	if h.activity == nil {
		return
	}
	subjects := []outbound.ActivitySubject{
		{SubjectType: "TASK", SubjectID: task.ID},
		{SubjectType: "USER", SubjectID: task.CreatedByUserID},
		{SubjectType: "USER", SubjectID: task.AssignedUserID},
	}
	if task.BoardID != "" {
		subjects = append(subjects, outbound.ActivitySubject{SubjectType: "BOARD", SubjectID: task.BoardID})
	}
	if task.ApproverUserID != nil && strings.TrimSpace(*task.ApproverUserID) != "" {
		subjects = append(subjects, outbound.ActivitySubject{SubjectType: "USER", SubjectID: *task.ApproverUserID})
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = h.activity.RecordEvent(ctx, event, subjects)
	}()
}

func (h *TaskOrchestrationHandler) recordBoardMemberEventAsync(
	organizationID string,
	actorUserID string,
	actorUserName string,
	boardID string,
	memberUserID string,
	memberName string,
) {
	if h.activity == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = h.activity.RecordEvent(ctx, model.ActivityEvent{
			OrganizationID: organizationID,
			ActorUserID:    actorUserID,
			ActorUserName:  actorUserName,
			EntityType:     model.ActivityEntityTypeTask,
			EntityID:       boardID,
			ActionType:     model.ActivityActionTaskMemberAdded,
			Summary:        "Участник добавлен в доску: " + memberName,
			BoardID:        &boardID,
		}, []outbound.ActivitySubject{
			{SubjectType: "BOARD", SubjectID: boardID},
			{SubjectType: "USER", SubjectID: memberUserID},
			{SubjectType: "USER", SubjectID: actorUserID},
		})
	}()
}

func (h *TaskOrchestrationHandler) notifyTaskAssignmentAsync(result model.TaskAssignmentResult) {
	if h.notifier == nil || strings.TrimSpace(result.Task.AssignedUserID) == "" {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = h.notifier.NotifyTaskAssigned(
			ctx,
			result.Actor.UserID,
			result.Task.AssignedUserID,
			result.Actor.OrganizationID,
			result.Task.ID,
			result.Task.Title,
		)
	}()
}
