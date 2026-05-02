package outbound

import (
	"context"

	"edo/services/authorization-audit-service/internal/domain/model"
)

type AuditRepository interface {
	AppendEvent(ctx context.Context, event model.AuditEvent) (model.AuditEvent, error)
	GetByTargetID(ctx context.Context, targetID string, limit int32, offset int32) ([]model.AuditEvent, error)
}
