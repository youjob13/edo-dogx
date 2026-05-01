package service

import (
	"context"
	"fmt"

	"edo/services/service/internal/ports/outbound"
)

type NotificationDispatcherService struct {
	publisher outbound.NotificationPublisher
	maxRetry  int
}

func NewNotificationDispatcherService(
	publisher outbound.NotificationPublisher,
	maxRetry int,
) *NotificationDispatcherService {
	if maxRetry <= 0 {
		maxRetry = 3
	}
	return &NotificationDispatcherService{publisher: publisher, maxRetry: maxRetry}
}

func (s *NotificationDispatcherService) Dispatch(
	ctx context.Context,
	actorUserID string,
	eventType string,
	recipientUserID string,
	documentID string,
) (string, error) {
	return s.publisher.Emit(ctx, actorUserID, eventType, recipientUserID, documentID)
}

func (s *NotificationDispatcherService) RetryFailed(
	ctx context.Context,
	actorUserID string,
	batchSize int32,
) (int32, error) {
	if batchSize <= 0 {
		batchSize = int32(s.maxRetry)
	}
	retried, err := s.publisher.RetryFailed(ctx, actorUserID, batchSize)
	if err != nil {
		return 0, fmt.Errorf("retry failed notifications: %w", err)
	}
	return retried, nil
}
