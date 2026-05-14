package grpcadapter

import (
	"context"

	pb "edo/services/notification-service/internal/adapters/inbound/grpc/pb"
	app "edo/services/notification-service/internal/application/service"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type NotificationHandler struct {
	pb.UnimplementedNotificationServiceServer
	service *app.NotificationService
}

func NewNotificationHandler(service *app.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: service}
}

func (h *NotificationHandler) Register(server *grpc.Server) {
	pb.RegisterNotificationServiceServer(server, h)
}

func (h *NotificationHandler) CreateNotification(ctx context.Context, req *pb.CreateNotificationRequest) (*pb.CreateNotificationResponse, error) {
	item, err := h.service.CreateNotification(ctx, app.CreateInput{
		RecipientUserID: req.GetRecipientUserId(),
		OrganizationID:  req.GetOrganizationId(),
		EventType:       req.GetEventType(),
		Title:           req.GetTitle(),
		Body:            req.GetBody(),
		EntityType:      req.GetEntityType(),
		EntityID:        req.GetEntityId(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.CreateNotificationResponse{Item: app.ToProto(item)}, nil
}

func (h *NotificationHandler) ListNotifications(ctx context.Context, req *pb.ListNotificationsRequest) (*pb.ListNotificationsResponse, error) {
	items, total, err := h.service.ListNotifications(ctx, req.GetActorUserId(), req.GetOrganizationId(), int(req.GetLimit()), int(req.GetOffset()))
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	res := make([]*pb.Notification, 0, len(items))
	for _, item := range items {
		res = append(res, app.ToProto(item))
	}
	return &pb.ListNotificationsResponse{Items: res, Total: int32(total)}, nil
}

func (h *NotificationHandler) MarkNotificationRead(ctx context.Context, req *pb.MarkNotificationReadRequest) (*pb.MarkNotificationReadResponse, error) {
	item, err := h.service.MarkNotificationRead(ctx, req.GetActorUserId(), req.GetOrganizationId(), req.GetNotificationId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.MarkNotificationReadResponse{Item: app.ToProto(item)}, nil
}

func (h *NotificationHandler) GetUnreadCount(ctx context.Context, req *pb.GetUnreadCountRequest) (*pb.GetUnreadCountResponse, error) {
	total, err := h.service.GetUnreadCount(ctx, req.GetActorUserId(), req.GetOrganizationId())
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.GetUnreadCountResponse{Total: int32(total)}, nil
}

func (h *NotificationHandler) EmitNotification(ctx context.Context, req *pb.EmitNotificationRequest) (*pb.EmitNotificationResponse, error) {
	item, err := h.service.CreateNotification(ctx, app.CreateInput{
		RecipientUserID: req.GetRecipientUserId(),
		OrganizationID:  "org-main",
		EventType:       req.GetEventType(),
		Title:           "Уведомление",
		Body:            req.GetEventType(),
		EntityType:      "DOCUMENT",
		EntityID:        req.GetDocumentId(),
	})
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &pb.EmitNotificationResponse{NotificationId: item.ID}, nil
}

func (h *NotificationHandler) RetryFailedNotifications(_ context.Context, _ *pb.RetryFailedNotificationsRequest) (*pb.RetryFailedNotificationsResponse, error) {
	return &pb.RetryFailedNotificationsResponse{RetriedCount: 0}, nil
}
