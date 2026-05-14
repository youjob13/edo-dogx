package grpcadapter

import (
	"context"
	"time"

	pb "edo/services/search-notification-service/internal/adapters/inbound/grpc/pb"
	app "edo/services/search-notification-service/internal/application/service"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type SearchNotificationHandler struct {
	pb.UnimplementedSearchNotificationServiceServer
	service *app.SearchNotificationService
}

func NewSearchNotificationHandler(service *app.SearchNotificationService) *SearchNotificationHandler {
	return &SearchNotificationHandler{service: service}
}

func (h *SearchNotificationHandler) Register(server *grpc.Server) {
	pb.RegisterSearchNotificationServiceServer(server, h)
}

func (h *SearchNotificationHandler) SyncSearchProjection(ctx context.Context, req *pb.SyncSearchProjectionRequest) (*pb.SyncSearchProjectionResponse, error) {
	err := h.service.SyncProjection(ctx, app.SearchEntityType(req.GetEntityType()), req.GetEntityId(), req.GetDeleted())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.SyncSearchProjectionResponse{Synced: true, IndexedAt: time.Now().UTC().Format(time.RFC3339)}, nil
}

func (h *SearchNotificationHandler) SearchDocuments(ctx context.Context, req *pb.SearchDocumentsRequest) (*pb.SearchDocumentsResponse, error) {
	hits, _, err := h.service.SearchGlobal(ctx, req.GetActorUserId(), req.GetQuery(), int(req.GetLimit()), int(req.GetOffset()), []app.SearchEntityType{app.SearchEntityDocument})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	items := make([]*pb.Document, 0, len(hits))
	for _, hit := range hits {
		items = append(items, &pb.Document{Id: hit.ID, Title: hit.Title, Category: hit.Category, UpdatedAt: hit.UpdatedAt, OwnerUserId: hit.OwnerUserID})
	}
	return &pb.SearchDocumentsResponse{Items: items, Total: int32(len(items))}, nil
}

func (h *SearchNotificationHandler) SearchGlobal(ctx context.Context, req *pb.SearchGlobalRequest) (*pb.SearchGlobalResponse, error) {
	entities := make([]app.SearchEntityType, 0, len(req.GetEntities()))
	for _, entity := range req.GetEntities() {
		switch entity {
		case pb.SearchEntityType_SEARCH_ENTITY_TYPE_TASK:
			entities = append(entities, app.SearchEntityTask)
		default:
			entities = append(entities, app.SearchEntityDocument)
		}
	}

	hits, total, err := h.service.SearchGlobal(ctx, req.GetActorUserId(), req.GetQuery(), int(req.GetLimit()), int(req.GetOffset()), entities)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}

	responseItems := make([]*pb.SearchHit, 0, len(hits))
	for _, hit := range hits {
		entityType := pb.SearchEntityType_SEARCH_ENTITY_TYPE_DOCUMENT
		if hit.EntityType == app.SearchEntityTask {
			entityType = pb.SearchEntityType_SEARCH_ENTITY_TYPE_TASK
		}
		responseItems = append(responseItems, &pb.SearchHit{
			EntityType:     entityType,
			Id:             hit.ID,
			Title:          hit.Title,
			Subtitle:       hit.Subtitle,
			Status:         hit.Status,
			UpdatedAt:      hit.UpdatedAt,
			Route:          hit.Route,
			DocumentId:     hit.DocumentID,
			TaskId:         hit.TaskID,
			BoardId:        hit.BoardID,
			Category:       hit.Category,
			OwnerUserId:    hit.OwnerUserID,
			CreatorUserId:  hit.CreatorUserID,
			AssigneeUserId: hit.AssigneeUserID,
			ApproverUserId: hit.ApproverUserID,
		})
	}

	return &pb.SearchGlobalResponse{Items: responseItems, Total: int32(total)}, nil
}

func (h *SearchNotificationHandler) EmitNotification(_ context.Context, _ *pb.EmitNotificationRequest) (*pb.EmitNotificationResponse, error) {
	return &pb.EmitNotificationResponse{NotificationId: "stub-notification"}, nil
}

func (h *SearchNotificationHandler) RetryFailedNotifications(_ context.Context, _ *pb.RetryFailedNotificationsRequest) (*pb.RetryFailedNotificationsResponse, error) {
	return &pb.RetryFailedNotificationsResponse{RetriedCount: 0}, nil
}
