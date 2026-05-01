package service

import "context"

type SearchNotificationService struct{}

func NewSearchNotificationService() *SearchNotificationService {
	return &SearchNotificationService{}
}

func (s *SearchNotificationService) SyncProjection(ctx context.Context, documentID string) error {
	_ = ctx
	_ = documentID
	return nil
}

func (s *SearchNotificationService) DispatchNotification(ctx context.Context, eventType string, recipient string) error {
	_ = ctx
	_ = eventType
	_ = recipient
	return nil
}
