package postgres

import (
	"context"
	"database/sql"
	"encoding/json"

	"edo/services/document-service/internal/domain/model"
)

type DocumentVersionRepository struct {
	db *sql.DB
}

func NewDocumentVersionRepository(db *sql.DB) *DocumentVersionRepository {
	return &DocumentVersionRepository{db: db}
}

func (r *DocumentVersionRepository) AppendVersion(ctx context.Context, document model.Document, actorUserID string, changeSummary string) error {
	const query = `
		INSERT INTO document_versions (document_id, version_number, title, category, status, changed_by_user_id, change_summary, content_document_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`

	content, err := json.Marshal(document.ContentDocument)
	if err != nil {
		return err
	}

	_, err = r.db.ExecContext(ctx, query, document.ID, document.Version, document.Title, document.Category, string(document.Status), actorUserID, changeSummary, content)
	return err
}
