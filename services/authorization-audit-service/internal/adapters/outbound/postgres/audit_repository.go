package postgres

import (
	"context"
	"database/sql"
	"encoding/json"

	"edo/services/authorization-audit-service/internal/domain/model"
)

type AuditRepository struct {
	db *sql.DB
}

func NewAuditRepository(db *sql.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) AppendEvent(ctx context.Context, event model.AuditEvent) (model.AuditEvent, error) {
	const query = `
		INSERT INTO audit_events (actor_user_id, action_type, target_id, outcome, metadata)
		VALUES ($1, $2, $3, $4, $5::jsonb)
		RETURNING id, occurred_at
	`

	metadataJSON := []byte("{}")
	if len(event.Metadata) > 0 {
		encoded, err := json.Marshal(event.Metadata)
		if err != nil {
			return model.AuditEvent{}, err
		}
		metadataJSON = encoded
	}

	row := r.db.QueryRowContext(ctx, query, event.ActorUserID, event.ActionType, event.TargetID, event.Outcome, string(metadataJSON))
	if err := row.Scan(&event.ID, &event.OccurredAt); err != nil {
		return model.AuditEvent{}, err
	}

	return event, nil
}

func (r *AuditRepository) GetByTargetID(ctx context.Context, targetID string, limit int32, offset int32) ([]model.AuditEvent, error) {
	const query = `
		SELECT id, actor_user_id, action_type, target_id, outcome, occurred_at
		FROM audit_events
		WHERE target_id = $1
		ORDER BY occurred_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.QueryContext(ctx, query, targetID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]model.AuditEvent, 0)
	for rows.Next() {
		var event model.AuditEvent
		if err := rows.Scan(&event.ID, &event.ActorUserID, &event.ActionType, &event.TargetID, &event.Outcome, &event.OccurredAt); err != nil {
			return nil, err
		}
		result = append(result, event)
	}

	return result, rows.Err()
}
