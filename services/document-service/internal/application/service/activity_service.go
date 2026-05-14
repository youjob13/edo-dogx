package service

import (
	"context"
	"strings"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"
)

type ActivityService struct {
	repository outbound.ActivityRepository
}

func NewActivityService(repository outbound.ActivityRepository) *ActivityService {
	return &ActivityService{repository: repository}
}

func (s *ActivityService) RecordEvent(ctx context.Context, event model.ActivityEvent, subjects []outbound.ActivitySubject) error {
	if s == nil || s.repository == nil {
		return nil
	}
	if strings.TrimSpace(event.ActorUserName) == "" {
		event.ActorUserName = event.ActorUserID
	}
	if event.OrganizationID == "" {
		event.OrganizationID = "org-main"
	}
	return s.repository.RecordEvent(ctx, outbound.RecordActivityInput{Event: event, Subjects: subjects})
}

func (s *ActivityService) ListForUser(ctx context.Context, input outbound.ListActivityEventsInput) ([]model.ActivityEvent, int, error) {
	if input.Limit <= 0 {
		input.Limit = 20
	}
	if input.Limit > 100 {
		input.Limit = 100
	}
	if input.Offset < 0 {
		input.Offset = 0
	}
	if strings.TrimSpace(input.OrganizationID) == "" {
		input.OrganizationID = "org-main"
	}
	return s.repository.ListEvents(ctx, input)
}

func (s *ActivityService) CleanupExpired(ctx context.Context, retentionDays int) (int64, error) {
	if s == nil || s.repository == nil {
		return 0, nil
	}
	if retentionDays <= 0 {
		retentionDays = 90
	}
	return s.repository.CleanupExpiredEvents(ctx, retentionDays)
}
