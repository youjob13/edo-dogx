package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"
)

type ActivityRepository struct {
	db *sql.DB
}

func NewActivityRepository(db *sql.DB) *ActivityRepository {
	return &ActivityRepository{db: db}
}

func (r *ActivityRepository) RecordEvent(ctx context.Context, input outbound.RecordActivityInput) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	event := input.Event
	if event.OccurredAt.IsZero() {
		event.OccurredAt = time.Now().UTC()
	}
	if strings.TrimSpace(event.ActorUserName) == "" || strings.TrimSpace(event.ActorUserName) == strings.TrimSpace(event.ActorUserID) {
		if resolvedName, err := r.resolveActorName(ctx, event.OrganizationID, event.ActorUserID); err == nil && strings.TrimSpace(resolvedName) != "" {
			event.ActorUserName = resolvedName
		}
	}

	const insertEvent = `
		INSERT INTO activity_events (
			organization_id, actor_user_id, actor_user_name,
			entity_type, entity_id, action_type, summary, metadata, occurred_at,
			document_id, task_id, board_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::uuid,$11::uuid,$12::uuid)
		RETURNING id`

	metadata, err := json.Marshal(event.Metadata)
	if err != nil {
		return fmt.Errorf("failed to encode activity metadata: %w", err)
	}
	if event.Metadata == nil {
		metadata = []byte(`{}`)
	}

	var eventID string
	if err := tx.QueryRowContext(ctx, insertEvent,
		event.OrganizationID,
		event.ActorUserID,
		event.ActorUserName,
		string(event.EntityType),
		event.EntityID,
		string(event.ActionType),
		event.Summary,
		string(metadata),
		event.OccurredAt,
		toNullableString(event.DocumentID),
		toNullableString(event.TaskID),
		toNullableString(event.BoardID),
	).Scan(&eventID); err != nil {
		return err
	}

	const insertSubject = `INSERT INTO activity_event_subjects (event_id, subject_type, subject_id) VALUES ($1::uuid, $2, $3) ON CONFLICT DO NOTHING`
	for _, subject := range input.Subjects {
		typeName := strings.ToUpper(strings.TrimSpace(subject.SubjectType))
		subjectID := strings.TrimSpace(subject.SubjectID)
		if typeName == "" || subjectID == "" {
			continue
		}
		if _, err := tx.ExecContext(ctx, insertSubject, eventID, typeName, subjectID); err != nil {
			return err
		}
	}

	if _, err := tx.ExecContext(ctx, insertSubject, eventID, "USER", event.ActorUserID); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *ActivityRepository) ListEvents(ctx context.Context, input outbound.ListActivityEventsInput) ([]model.ActivityEvent, int, error) {
	where := `
		WHERE e.organization_id = $1
		  AND EXISTS (
			SELECT 1 FROM activity_event_subjects s
			WHERE s.event_id = e.id
			  AND s.subject_type = 'USER'
			  AND s.subject_id = $2
		  )`
	args := []any{input.OrganizationID, input.ActorUserID}

	if q := strings.TrimSpace(input.Query); q != "" {
		where += fmt.Sprintf(" AND (e.summary ILIKE $%d OR e.actor_user_name ILIKE $%d)", len(args)+1, len(args)+1)
		args = append(args, "%"+q+"%")
	}

	countQuery := `SELECT COUNT(*) FROM activity_events e ` + where
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
		SELECT e.id::text, e.organization_id, e.actor_user_id, e.actor_user_name,
		       e.entity_type, e.entity_id, e.action_type, e.summary,
		       e.occurred_at, e.document_id::text, e.task_id::text, e.board_id::text
		FROM activity_events e ` + where + fmt.Sprintf(`
		ORDER BY e.occurred_at DESC, e.created_at DESC
		LIMIT $%d OFFSET $%d`, len(args)+1, len(args)+2)
	args = append(args, input.Limit, input.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]model.ActivityEvent, 0)
	for rows.Next() {
		var item model.ActivityEvent
		var documentID sql.NullString
		var taskID sql.NullString
		var boardID sql.NullString
		if err := rows.Scan(
			&item.ID,
			&item.OrganizationID,
			&item.ActorUserID,
			&item.ActorUserName,
			&item.EntityType,
			&item.EntityID,
			&item.ActionType,
			&item.Summary,
			&item.OccurredAt,
			&documentID,
			&taskID,
			&boardID,
		); err != nil {
			return nil, 0, err
		}
		if documentID.Valid {
			item.DocumentID = &documentID.String
		}
		if taskID.Valid {
			item.TaskID = &taskID.String
		}
		if boardID.Valid {
			item.BoardID = &boardID.String
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (r *ActivityRepository) CleanupExpiredEvents(ctx context.Context, retentionDays int) (int64, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM activity_events WHERE occurred_at < NOW() - ($1::int * INTERVAL '1 day')`, retentionDays)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

func toNullableString(value *string) any {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	return strings.TrimSpace(*value)
}

// resolveNameByUserID resolves user full name from organization_members table.
// Returns empty string if not found (graceful fallback).
func resolveNameByUserID(ctx context.Context, db *sql.DB, organizationID string, userID string) string {
	if organizationID == "" || userID == "" {
		return ""
	}
	var fullName string
	err := db.QueryRowContext(
		ctx,
		`SELECT full_name FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
		organizationID,
		userID,
	).Scan(&fullName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(fullName)
}

func (r *ActivityRepository) resolveActorName(ctx context.Context, organizationID string, actorUserID string) (string, error) {
	var fullName string
	err := r.db.QueryRowContext(
		ctx,
		`SELECT full_name FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
		organizationID,
		actorUserID,
	).Scan(&fullName)
	if err != nil {
		return "", err
	}
	return fullName, nil
}

var _ outbound.ActivityRepository = (*ActivityRepository)(nil)
