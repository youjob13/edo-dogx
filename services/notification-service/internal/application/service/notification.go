package service

import (
	"context"
	"time"

	pb "edo/services/notification-service/internal/adapters/inbound/grpc/pb"
)

type NotificationStore interface {
	Create(ctx context.Context, in CreateInput) (Notification, error)
	List(ctx context.Context, actorUserID string, organizationID string, limit int, offset int) ([]Notification, int, error)
	MarkRead(ctx context.Context, actorUserID string, organizationID string, notificationID string) (Notification, error)
	UnreadCount(ctx context.Context, actorUserID string, organizationID string) (int, error)
	Cleanup(ctx context.Context, retentionDays int) (int64, error)
}

type CreateInput struct {
	RecipientUserID string
	OrganizationID  string
	EventType       string
	Title           string
	Body            string
	EntityType      string
	EntityID        string
}

type Notification struct {
	ID              string
	RecipientUserID string
	OrganizationID  string
	EventType       string
	Title           string
	Body            string
	EntityType      string
	EntityID        string
	Status          string
	IsRead          bool
	CreatedAt       time.Time
	DeliveredAt     *time.Time
	ReadAt          *time.Time
}

type NotificationService struct {
	store NotificationStore
}

func NewNotificationService(store NotificationStore) *NotificationService {
	return &NotificationService{store: store}
}

func (s *NotificationService) CreateNotification(ctx context.Context, in CreateInput) (Notification, error) {
	return s.store.Create(ctx, in)
}

func (s *NotificationService) ListNotifications(ctx context.Context, actorUserID string, organizationID string, limit int, offset int) ([]Notification, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	return s.store.List(ctx, actorUserID, organizationID, limit, offset)
}

func (s *NotificationService) MarkNotificationRead(ctx context.Context, actorUserID string, organizationID string, notificationID string) (Notification, error) {
	return s.store.MarkRead(ctx, actorUserID, organizationID, notificationID)
}

func (s *NotificationService) GetUnreadCount(ctx context.Context, actorUserID string, organizationID string) (int, error) {
	return s.store.UnreadCount(ctx, actorUserID, organizationID)
}

func (s *NotificationService) Cleanup(ctx context.Context, retentionDays int) (int64, error) {
	if retentionDays <= 0 {
		retentionDays = 90
	}
	return s.store.Cleanup(ctx, retentionDays)
}

func ToProto(n Notification) *pb.Notification {
	item := &pb.Notification{
		Id:              n.ID,
		RecipientUserId: n.RecipientUserID,
		OrganizationId:  n.OrganizationID,
		EventType:       n.EventType,
		Title:           n.Title,
		Body:            n.Body,
		EntityType:      n.EntityType,
		EntityId:        n.EntityID,
		Status:          n.Status,
		IsRead:          n.IsRead,
		CreatedAt:       n.CreatedAt.UTC().Format(time.RFC3339),
	}
	if n.DeliveredAt != nil {
		item.DeliveredAt = n.DeliveredAt.UTC().Format(time.RFC3339)
	}
	if n.ReadAt != nil {
		item.ReadAt = n.ReadAt.UTC().Format(time.RFC3339)
	}
	return item
}
