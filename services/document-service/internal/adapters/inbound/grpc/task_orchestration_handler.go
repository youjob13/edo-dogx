package grpcadapter

import (
	"context"
	"strings"
	"time"

	"edo/services/document-service/internal/adapters/inbound/grpc/pb"
	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type TaskOrchestrationHandler struct {
	pb.UnimplementedTaskOrchestrationServiceServer
	taskRepository outbound.TaskRepository
}

func NewTaskOrchestrationHandler(taskRepository outbound.TaskRepository) *TaskOrchestrationHandler {
	return &TaskOrchestrationHandler{taskRepository: taskRepository}
}

func (h *TaskOrchestrationHandler) Register(server *grpc.Server) {
	pb.RegisterTaskOrchestrationServiceServer(server, h)
}

func (h *TaskOrchestrationHandler) CreateTaskBoard(ctx context.Context, req *pb.CreateTaskBoardRequest) (*pb.CreateTaskBoardResponse, error) {
	if req.GetOrganizationId() == "" || req.GetName() == "" {
		return nil, status.Error(codes.InvalidArgument, "organization_id and name are required")
	}

	board, err := h.taskRepository.CreateTaskBoard(ctx, model.TaskBoard{
		OrganizationID: req.GetOrganizationId(),
		Name:           req.GetName(),
		Description:    req.GetDescription(),
	})
	if err != nil {
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

	board, err := h.taskRepository.GetTaskBoard(ctx, req.GetBoardId())
	if err != nil {
		if err == model.ErrTaskNotFound {
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
		})
	}

	tasks := make([]*pb.Task, 0, len(board.Tasks))
	for _, task := range board.Tasks {
		taskProto := &pb.Task{
			Id:               task.ID,
			Title:            task.Title,
			Description:      task.Description,
			Status:           string(task.Status),
			TaskType:         string(task.TaskType),
			CreatorUserId:    task.CreatedByUserID,
			CreatorUserName:  task.CreatedByUserName,
			AssigneeUserId:   task.AssignedUserID,
			AssigneeUserName: task.AssignedUserName,
			CreatedAt:        task.CreatedAt.Format(time.RFC3339),
			UpdatedAt:        task.UpdatedAt.Format(time.RFC3339),
		}

		if task.ApproverUserID != nil {
			taskProto.ApproverUserId = *task.ApproverUserID
		}
		if task.ApproverUserName != nil {
			taskProto.ApproverUserName = *task.ApproverUserName
		}
		if task.Decision != nil {
			taskProto.Decision = string(*task.Decision)
		}
		if task.DecisionComment != nil {
			taskProto.DecisionComment = *task.DecisionComment
		}
		if task.DueDate != nil {
			taskProto.DueDate = task.DueDate.Format(time.RFC3339)
		}
		tasks = append(tasks, taskProto)
	}

	return &pb.GetTaskBoardResponse{
		Board: &pb.TaskBoard{
			Id:                 board.ID,
			Name:               board.Name,
			Members:            members,
			Tasks:              tasks,
			AvailableDocuments: []*pb.TaskAttachment{},
			AvailableApprovers: []*pb.BoardMember{},
		},
	}, nil
}

func (h *TaskOrchestrationHandler) ListTaskBoards(ctx context.Context, req *pb.ListTaskBoardsRequest) (*pb.ListTaskBoardsResponse, error) {
	if h.taskRepository == nil {
		return nil, status.Error(codes.Internal, "task repository is not configured")
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

	boards, total, err := h.taskRepository.ListTaskBoards(ctx, outbound.TaskBoardFilter{
		OrganizationID: organizationID,
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

	return &pb.ListTaskBoardsResponse{
		Boards:   items,
		Total:    int32(total),
		Page:     page,
		PageSize: int32(limit),
	}, nil
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

	taskType := model.TaskType(req.GetTaskType())
	if taskType == "" {
		taskType = model.TaskTypeGeneral
	}
	if taskType != model.TaskTypeGeneral && taskType != model.TaskTypeApproval {
		return nil, status.Error(codes.InvalidArgument, "task_type must be 'general' or 'approval'")
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

	createdTask, err := h.taskRepository.CreateTask(ctx, model.Task{
		BoardID:           req.GetBoardId(),
		Title:             strings.TrimSpace(req.GetTitle()),
		Description:       strings.TrimSpace(req.GetDescription()),
		Status:            model.TaskStatus("pending"),
		TaskType:          taskType,
		CreatedByUserID:   req.GetActorUserId(),
		CreatedByUserName: req.GetActorUserId(),
		AssignedUserID:    req.GetAssigneeUserId(),
		AssignedUserName:  req.GetAssigneeUserId(),
		ApproverUserID:    approverUserID,
		ApproverUserName:  approverUserID,
		DueDate:           dueDate,
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	task := &pb.Task{
		Id:               createdTask.ID,
		Title:            createdTask.Title,
		Description:      createdTask.Description,
		Status:           string(createdTask.Status),
		TaskType:         string(createdTask.TaskType),
		CreatorUserId:    createdTask.CreatedByUserID,
		CreatorUserName:  createdTask.CreatedByUserName,
		AssigneeUserId:   createdTask.AssignedUserID,
		AssigneeUserName: createdTask.AssignedUserName,
		CreatedAt:        createdTask.CreatedAt.Format(time.RFC3339),
		UpdatedAt:        createdTask.UpdatedAt.Format(time.RFC3339),
	}

	if createdTask.ApproverUserID != nil {
		task.ApproverUserId = *createdTask.ApproverUserID
	}
	if createdTask.ApproverUserName != nil {
		task.ApproverUserName = *createdTask.ApproverUserName
	}
	if createdTask.DueDate != nil {
		task.DueDate = createdTask.DueDate.Format(time.RFC3339)
	}

	return &pb.CreateTaskResponse{Task: task}, nil
}

func (h *TaskOrchestrationHandler) ListOrganizationMembers(ctx context.Context, req *pb.ListOrganizationMembersRequest) (*pb.ListOrganizationMembersResponse, error) {
	if strings.TrimSpace(req.GetOrganizationId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "organization_id is required")
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
		items = append(items, &pb.BoardMember{
			Id:         member.UserID,
			FullName:   member.FullName,
			Department: member.Department,
			Email:      member.Email,
		})
	}

	return &pb.ListOrganizationMembersResponse{
		Items: items,
		Total: int32(total),
	}, nil
}

func (h *TaskOrchestrationHandler) AddTaskBoardMember(ctx context.Context, req *pb.AddTaskBoardMemberRequest) (*pb.AddTaskBoardMemberResponse, error) {
	if strings.TrimSpace(req.GetBoardId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "board_id is required")
	}
	if strings.TrimSpace(req.GetUserId()) == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	member, err := h.taskRepository.AddTaskBoardMember(ctx, req.GetBoardId(), req.GetUserId())
	if err != nil {
		if err == model.ErrTaskBoardNotFound || err == model.ErrTaskMemberNotFound {
			return nil, status.Error(codes.NotFound, err.Error())
		}
		return nil, status.Error(codes.Internal, err.Error())
	}

	return &pb.AddTaskBoardMemberResponse{
		Member: &pb.BoardMember{
			Id:         member.UserID,
			FullName:   member.FullName,
			Department: member.Department,
			Email:      member.Email,
		},
	}, nil
}
