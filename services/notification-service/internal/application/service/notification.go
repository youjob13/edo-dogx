package service

import (
	"context"
	"log/slog"
	"strings"
	"time"

	pb "edo/services/notification-service/internal/adapters/inbound/grpc/pb"
)

type NotificationStore interface {
	Create(ctx context.Context, in CreateInput) (Notification, error)
	List(ctx context.Context, actorUserID string, organizationID string, limit int, offset int) ([]Notification, int, error)
	MarkRead(ctx context.Context, actorUserID string, organizationID string, notificationID string) (Notification, error)
	UnreadCount(ctx context.Context, actorUserID string, organizationID string) (int, error)
	Cleanup(ctx context.Context, retentionDays int) (int64, error)
	RecordDelivery(ctx context.Context, notificationID string, channel string, status string, errorText string) error
	ResolveRecipientEmail(ctx context.Context, organizationID string, recipientUserID string) (string, error)
}

type EmailSender interface {
	Send(ctx context.Context, message EmailMessage) error
}

type CreateInput struct {
	RecipientUserID string
	RecipientEmail  string
	OrganizationID  string
	EventType       string
	Title           string
	Body            string
	EntityType      string
	EntityID        string
}

type EmailMessage struct {
	To      string
	Subject string
	Body    string
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
	store       NotificationStore
	emailSender EmailSender
}

func NewNotificationService(store NotificationStore, emailSender EmailSender) *NotificationService {
	return &NotificationService{store: store, emailSender: emailSender}
}

func (s *NotificationService) CreateNotification(ctx context.Context, in CreateInput) (Notification, error) {
	item, err := s.store.Create(ctx, in)
	if err != nil {
		return Notification{}, err
	}

	recipientEmail := strings.TrimSpace(in.RecipientEmail)
	if recipientEmail == "" && strings.TrimSpace(in.OrganizationID) != "" && strings.TrimSpace(in.RecipientUserID) != "" {
		resolvedEmail, err := s.store.ResolveRecipientEmail(ctx, in.OrganizationID, in.RecipientUserID)
		if err != nil {
			slog.Warn("failed to resolve recipient email", "organization_id", in.OrganizationID, "recipient_user_id", in.RecipientUserID, "err", err)
		} else {
			recipientEmail = strings.TrimSpace(resolvedEmail)
		}
	}
	if s.emailSender == nil || recipientEmail == "" {
		return item, nil
	}

	if err := s.emailSender.Send(ctx, EmailMessage{
		To:      recipientEmail,
		Subject: in.Title,
		Body:    in.Body,
	}); err != nil {
		slog.Warn("failed to deliver email notification", "notification_id", item.ID, "recipient_email", recipientEmail, "err", err)
		_ = s.store.RecordDelivery(ctx, item.ID, "EMAIL", "FAILED", err.Error())
		return item, nil
	}

	if err := s.store.RecordDelivery(ctx, item.ID, "EMAIL", "SENT", ""); err != nil {
		slog.Warn("failed to record email delivery", "notification_id", item.ID, "recipient_email", recipientEmail, "err", err)
	}

	return item, nil
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
