package postgres

import (
	"context"
	"database/sql"
	"errors"
	"time"

	app "edo/services/notification-service/internal/application/service"
)

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store { return &Store{db: db} }

func (s *Store) Create(ctx context.Context, in app.CreateInput) (app.Notification, error) {
	var n app.Notification
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO notifications (
			recipient_user_id, organization_id, event_type, title, body, entity_type, entity_id, status, is_read, created_at, delivered_at
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,'SENT',false,NOW(),NOW())
		RETURNING id, recipient_user_id, organization_id, event_type, title, body, entity_type, entity_id, status, is_read, created_at, delivered_at, read_at`,
		in.RecipientUserID, in.OrganizationID, in.EventType, in.Title, in.Body, in.EntityType, in.EntityID,
	).Scan(&n.ID, &n.RecipientUserID, &n.OrganizationID, &n.EventType, &n.Title, &n.Body, &n.EntityType, &n.EntityID, &n.Status, &n.IsRead, &n.CreatedAt, &n.DeliveredAt, &n.ReadAt)
	if err != nil {
		return app.Notification{}, err
	}
	_, _ = s.db.ExecContext(ctx, `INSERT INTO notification_deliveries (notification_id, channel, attempt, status, error, created_at) VALUES ($1::uuid,'SSE',1,'SENT','',NOW())`, n.ID)
	return n, nil
}

func (s *Store) List(ctx context.Context, actorUserID string, organizationID string, limit int, offset int) ([]app.Notification, int, error) {
	var total int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notifications WHERE recipient_user_id = $1 AND organization_id = $2`, actorUserID, organizationID).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, recipient_user_id, organization_id, event_type, title, body, entity_type, entity_id, status, is_read, created_at, delivered_at, read_at
		FROM notifications
		WHERE recipient_user_id = $1 AND organization_id = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4`, actorUserID, organizationID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]app.Notification, 0)
	for rows.Next() {
		var n app.Notification
		if err := rows.Scan(&n.ID, &n.RecipientUserID, &n.OrganizationID, &n.EventType, &n.Title, &n.Body, &n.EntityType, &n.EntityID, &n.Status, &n.IsRead, &n.CreatedAt, &n.DeliveredAt, &n.ReadAt); err != nil {
			return nil, 0, err
		}
		items = append(items, n)
	}
	return items, total, rows.Err()
}

func (s *Store) MarkRead(ctx context.Context, actorUserID string, organizationID string, notificationID string) (app.Notification, error) {
	var n app.Notification
	err := s.db.QueryRowContext(ctx, `
		UPDATE notifications
		SET is_read = true, read_at = NOW()
		WHERE id = $1::uuid AND recipient_user_id = $2 AND organization_id = $3
		RETURNING id, recipient_user_id, organization_id, event_type, title, body, entity_type, entity_id, status, is_read, created_at, delivered_at, read_at`, notificationID, actorUserID, organizationID).
		Scan(&n.ID, &n.RecipientUserID, &n.OrganizationID, &n.EventType, &n.Title, &n.Body, &n.EntityType, &n.EntityID, &n.Status, &n.IsRead, &n.CreatedAt, &n.DeliveredAt, &n.ReadAt)
	if err != nil {
		return app.Notification{}, err
	}
	return n, nil
}

func (s *Store) UnreadCount(ctx context.Context, actorUserID string, organizationID string) (int, error) {
	var total int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notifications WHERE recipient_user_id = $1 AND organization_id = $2 AND is_read = false`, actorUserID, organizationID).Scan(&total)
	return total, err
}

func (s *Store) Cleanup(ctx context.Context, retentionDays int) (int64, error) {
	res, err := s.db.ExecContext(ctx, `DELETE FROM notifications WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`, retentionDays)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (s *Store) RecordDelivery(ctx context.Context, notificationID string, channel string, status string, errorText string) error {
	attempt := 1
	if err := s.db.QueryRowContext(
		ctx,
		`SELECT COALESCE(MAX(attempt), 0) + 1 FROM notification_deliveries WHERE notification_id = $1::uuid AND channel = $2`,
		notificationID,
		channel,
	).Scan(&attempt); err != nil {
		return err
	}

	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO notification_deliveries (notification_id, channel, attempt, status, error, created_at) VALUES ($1::uuid, $2, $3, $4, $5, NOW())`,
		notificationID,
		channel,
		attempt,
		status,
		errorText,
	)
	return err
}

func (s *Store) ResolveRecipientEmail(ctx context.Context, organizationID string, recipientUserID string) (string, error) {
	var email string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT email FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
		organizationID,
		recipientUserID,
	).Scan(&email)
	if err == nil {
		return email, nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return "", err
}

func EnsureSchema(ctx context.Context, db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS notifications (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			recipient_user_id TEXT NOT NULL,
			organization_id TEXT NOT NULL,
			event_type TEXT NOT NULL,
			title TEXT NOT NULL,
			body TEXT NOT NULL,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			status TEXT NOT NULL,
			is_read BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			delivered_at TIMESTAMPTZ,
			read_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS notification_deliveries (
			notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
			channel TEXT NOT NULL,
			attempt INT NOT NULL,
			status TEXT NOT NULL,
			error TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (notification_id, channel, attempt)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread_created ON notifications(recipient_user_id, is_read, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_org_created ON notifications(organization_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_notifications_status_created ON notifications(status, created_at)`,
	}
	for _, st := range statements {
		if _, err := db.ExecContext(ctx, st); err != nil {
			return err
		}
	}
	return nil
}

var _ app.NotificationStore = (*Store)(nil)
var _ = time.RFC3339
