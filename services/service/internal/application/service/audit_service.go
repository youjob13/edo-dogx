package service

import (
	"context"
	"time"

	"edo/services/service/internal/ports/outbound"
)

type AuditService struct {
	repository outbound.AuditRepository
}

func NewAuditService(repository outbound.AuditRepository) *AuditService {
	return &AuditService{repository: repository}
}

func (s *AuditService) AppendAuditEvent(
	ctx context.Context,
	actorUserID string,
	actionType string,
	outcome string,
	targetID string,
) (string, error) {
	event := outbound.AuditEventRecord{
		ID:          "",
		ActorUserID: actorUserID,
		ActionType:  actionType,
		Outcome:     outcome,
		TargetID:    targetID,
		OccurredAt:  time.Now().UTC().Format(time.RFC3339),
	}
	return s.repository.Append(ctx, event)
}

func (s *AuditService) GetAuditEvents(ctx context.Context, actorUserID string, documentID string) ([]any, error) {
	items, err := s.repository.ListByDocument(ctx, actorUserID, documentID)
	if err != nil {
		return nil, err
	}
	result := make([]any, 0, len(items))
	for _, item := range items {
		result = append(result, item)
	}
	return result, nil
}
