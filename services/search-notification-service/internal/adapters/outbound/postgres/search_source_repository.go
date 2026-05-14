package postgres

import (
	"context"
	"database/sql"
	"strings"
	"time"

	app "edo/services/search-notification-service/internal/application/service"
)

type SearchSourceRepository struct {
	db *sql.DB
}

func NewSearchSourceRepository(db *sql.DB) *SearchSourceRepository {
	return &SearchSourceRepository{db: db}
}

func (r *SearchSourceRepository) ListDocuments(ctx context.Context) ([]app.IndexedDocument, error) {
	hasStatus, err := r.hasColumn(ctx, "documents", "status")
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id::text, title, category, updated_at, owner_user_id
		FROM documents`
	if hasStatus {
		query = `
		SELECT id::text, title, category, status, updated_at, owner_user_id
		FROM documents`
	}

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]app.IndexedDocument, 0)
	for rows.Next() {
		var item app.IndexedDocument
		if hasStatus {
			if err := rows.Scan(&item.ID, &item.Title, &item.Category, &item.Status, &item.UpdatedAt, &item.OwnerUserID); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&item.ID, &item.Title, &item.Category, &item.UpdatedAt, &item.OwnerUserID); err != nil {
				return nil, err
			}
			item.Status = "DRAFT"
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *SearchSourceRepository) ListTasks(ctx context.Context) ([]app.IndexedTask, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			t.id::text,
			COALESCE(t.board_id::text, ''),
			t.title,
			LOWER(t.status),
			t.updated_at,
			t.creator_user_id,
			t.assignee_user_id,
			COALESCE(t.approver_user_id, ''),
			COALESCE(string_agg(DISTINCT m.user_id, ','), '') AS board_member_ids
		FROM tasks t
		LEFT JOIN task_board_members m ON m.board_id = t.board_id
		GROUP BY t.id, t.board_id, t.title, t.status, t.updated_at, t.creator_user_id, t.assignee_user_id, t.approver_user_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]app.IndexedTask, 0)
	for rows.Next() {
		var item app.IndexedTask
		var boardMembers string
		if err := rows.Scan(&item.ID, &item.BoardID, &item.Title, &item.Status, &item.UpdatedAt, &item.CreatorUserID, &item.AssigneeUserID, &item.ApproverUserID, &boardMembers); err != nil {
			return nil, err
		}
		item.AllowedUserIDs = mergeUsers(append([]string{item.CreatorUserID, item.AssigneeUserID, item.ApproverUserID}, strings.Split(boardMembers, ",")...)...)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *SearchSourceRepository) GetDocumentByID(ctx context.Context, id string) (*app.IndexedDocument, error) {
	hasStatus, err := r.hasColumn(ctx, "documents", "status")
	if err != nil {
		return nil, err
	}

	item := &app.IndexedDocument{}
	if hasStatus {
		err = r.db.QueryRowContext(ctx, `
		SELECT id::text, title, category, status, updated_at, owner_user_id
		FROM documents
		WHERE id::text = $1`, id).Scan(&item.ID, &item.Title, &item.Category, &item.Status, &item.UpdatedAt, &item.OwnerUserID)
	} else {
		err = r.db.QueryRowContext(ctx, `
		SELECT id::text, title, category, updated_at, owner_user_id
		FROM documents
		WHERE id::text = $1`, id).Scan(&item.ID, &item.Title, &item.Category, &item.UpdatedAt, &item.OwnerUserID)
		item.Status = "DRAFT"
	}
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *SearchSourceRepository) GetTaskByID(ctx context.Context, id string) (*app.IndexedTask, error) {
	item := &app.IndexedTask{}
	var boardMembers string
	err := r.db.QueryRowContext(ctx, `
		SELECT
			t.id::text,
			COALESCE(t.board_id::text, ''),
			t.title,
			LOWER(t.status),
			t.updated_at,
			t.creator_user_id,
			t.assignee_user_id,
			COALESCE(t.approver_user_id, ''),
			COALESCE((
				SELECT string_agg(DISTINCT m.user_id, ',')
				FROM task_board_members m
				WHERE m.board_id = t.board_id
			), '')
		FROM tasks t
		WHERE t.id::text = $1`, id).Scan(&item.ID, &item.BoardID, &item.Title, &item.Status, &item.UpdatedAt, &item.CreatorUserID, &item.AssigneeUserID, &item.ApproverUserID, &boardMembers)
	if err != nil {
		return nil, err
	}
	item.AllowedUserIDs = mergeUsers(append([]string{item.CreatorUserID, item.AssigneeUserID, item.ApproverUserID}, strings.Split(boardMembers, ",")...)...)
	return item, nil
}

func mergeUsers(values ...string) []string {
	set := map[string]struct{}{}
	for _, value := range values {
		for _, part := range strings.Split(value, ",") {
			candidate := strings.TrimSpace(part)
			if candidate == "" {
				continue
			}
			set[candidate] = struct{}{}
		}
	}
	out := make([]string, 0, len(set))
	for userID := range set {
		out = append(out, userID)
	}
	return out
}

func (r *SearchSourceRepository) hasColumn(ctx context.Context, tableName string, columnName string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
			  AND table_name = $1
			  AND column_name = $2
		)`, tableName, columnName).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

var _ app.SearchSourceRepository = (*SearchSourceRepository)(nil)
var _ = time.RFC3339
