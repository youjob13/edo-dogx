package service

import (
	"context"
	"strconv"
	"time"

	"edo/services/authorization-audit-service/internal/domain/model"
	"edo/services/authorization-audit-service/internal/ports/outbound"
)

type AuditService struct {
	repo outbound.AuditRepository
}

func NewAuditService(repo outbound.AuditRepository) *AuditService {
	return &AuditService{repo: repo}
}

func (s *AuditService) AppendEvent(ctx context.Context, event model.AuditEvent) (model.AuditEvent, error) {
	event.OccurredAt = time.Now().UTC().Format(time.RFC3339)
	return s.repo.AppendEvent(ctx, event)
}

func (s *AuditService) GetDocumentEvents(ctx context.Context, documentID string, limit int32, offset int32) ([]model.AuditEvent, error) {
	return s.repo.GetByTargetID(ctx, documentID, limit, offset)
}

func (s *AuditService) AppendConflictEvent(
	ctx context.Context,
	actorUserID string,
	documentID string,
	expectedVersion int64,
	currentVersion int64,
) (model.AuditEvent, error) {
	return s.AppendEvent(ctx, model.AuditEvent{
		ActorUserID: actorUserID,
		ActionType:  "DOCUMENT_EDIT_CONFLICT",
		TargetID:    documentID,
		Outcome:     "FAILED",
		Metadata: map[string]string{
			"expectedVersion": strconv.FormatInt(expectedVersion, 10),
			"currentVersion":  strconv.FormatInt(currentVersion, 10),
		},
	})
}

func (s *AuditService) AppendDocumentRichCreateEvent(
	ctx context.Context,
	actorUserID string,
	documentID string,
	category string,
	contentNodes int,
) (model.AuditEvent, error) {
	return s.AppendEvent(ctx, model.AuditEvent{
		ActorUserID: actorUserID,
		ActionType:  "DOCUMENT_RICH_CREATE",
		TargetID:    documentID,
		Outcome:     "SUCCESS",
		Metadata: map[string]string{
			"category":     category,
			"contentNodes": strconv.Itoa(contentNodes),
		},
	})
}

func (s *AuditService) AppendDocumentRichEditEvent(
	ctx context.Context,
	actorUserID string,
	documentID string,
	newVersion int64,
	contentNodes int,
) (model.AuditEvent, error) {
	return s.AppendEvent(ctx, model.AuditEvent{
		ActorUserID: actorUserID,
		ActionType:  "DOCUMENT_RICH_EDIT",
		TargetID:    documentID,
		Outcome:     "SUCCESS",
		Metadata: map[string]string{
			"newVersion":   strconv.FormatInt(newVersion, 10),
			"contentNodes": strconv.Itoa(contentNodes),
		},
	})
}

func (s *AuditService) AppendExportRequestedEvent(
	ctx context.Context,
	actorUserID string,
	documentID string,
	exportRequestID string,
	format string,
	sourceVersion int64,
) (model.AuditEvent, error) {
	return s.AppendEvent(ctx, model.AuditEvent{
		ActorUserID: actorUserID,
		ActionType:  "DOCUMENT_EXPORT_REQUESTED",
		TargetID:    documentID,
		Outcome:     "SUCCESS",
		Metadata: map[string]string{
			"exportRequestId": exportRequestID,
			"format":          format,
			"sourceVersion":   strconv.FormatInt(sourceVersion, 10),
		},
	})
}

func (s *AuditService) AppendExportSucceededEvent(
	ctx context.Context,
	actorUserID string,
	documentID string,
	exportRequestID string,
	format string,
	artifactID string,
	artifactBytes int64,
) (model.AuditEvent, error) {
	return s.AppendEvent(ctx, model.AuditEvent{
		ActorUserID: actorUserID,
		ActionType:  "DOCUMENT_EXPORT_SUCCEEDED",
		TargetID:    documentID,
		Outcome:     "SUCCESS",
		Metadata: map[string]string{
			"exportRequestId": exportRequestID,
			"format":          format,
			"artifactId":      artifactID,
			"artifactBytes":   strconv.FormatInt(artifactBytes, 10),
		},
	})
}
