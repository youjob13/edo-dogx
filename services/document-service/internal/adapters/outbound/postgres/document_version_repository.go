package postgres

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"edo/services/document-service/internal/domain/model"

	"github.com/minio/minio-go/v7"
)

type DocumentVersionRepository struct {
	db           *sql.DB
	objectClient *minio.Client
	bucketName   string
}

func NewDocumentVersionRepository(db *sql.DB, objectClient *minio.Client, bucketName string) *DocumentVersionRepository {
	return &DocumentVersionRepository{db: db, objectClient: objectClient, bucketName: bucketName}
}

func buildDocumentContentKey(documentID string) string {
	return fmt.Sprintf("documents/%s/content.json", documentID)
}

func marshalContentDocument(content map[string]any) ([]byte, error) {
	if content == nil {
		content = map[string]any{}
	}
	return json.Marshal(content)
}

func unmarshalContentDocument(payload []byte) (map[string]any, error) {
	content := map[string]any{}
	if len(payload) == 0 {
		return content, nil
	}
	if err := json.Unmarshal(payload, &content); err != nil {
		return nil, err
	}
	return content, nil
}

func (r *DocumentVersionRepository) StoreContent(ctx context.Context, objectKey string, content map[string]any) (string, error) {
	if r.objectClient == nil {
		return "", fmt.Errorf("object storage client is not configured")
	}
	payload, err := marshalContentDocument(content)
	if err != nil {
		return "", err
	}
	info, err := r.objectClient.PutObject(
		ctx,
		r.bucketName,
		objectKey,
		bytes.NewReader(payload),
		int64(len(payload)),
		minio.PutObjectOptions{ContentType: "application/json"},
	)
	if err != nil {
		return "", err
	}
	return info.VersionID, nil
}

func (r *DocumentVersionRepository) LoadContent(ctx context.Context, objectKey string, objectVersionID string) (map[string]any, error) {
	if strings.TrimSpace(objectKey) == "" || strings.TrimSpace(objectVersionID) == "" {
		return nil, fmt.Errorf("document content object reference is incomplete")
	}
	if r.objectClient == nil {
		return nil, fmt.Errorf("object storage client is not configured")
	}
	opts := minio.GetObjectOptions{VersionID: objectVersionID}
	obj, err := r.objectClient.GetObject(ctx, r.bucketName, objectKey, opts)
	if err != nil {
		return nil, err
	}
	defer obj.Close()

	payload, err := io.ReadAll(obj)
	if err != nil {
		return nil, err
	}

	return unmarshalContentDocument(payload)
}

func (r *DocumentVersionRepository) AppendVersionTx(ctx context.Context, tx *sql.Tx, version model.DocumentVersion) error {
	const query = `
		INSERT INTO document_versions (document_id, version_number, title, category, status, changed_by_user_id, change_summary, object_key, object_version_id, content_document_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	contentJSON, err := marshalContentDocument(version.ContentDocument)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(
		ctx,
		query,
		version.DocumentID,
		version.VersionNumber,
		version.Title,
		version.Category,
		string(version.Status),
		version.ChangedByUserID,
		version.ChangeSummary,
		version.ObjectKey,
		version.ObjectVersionID,
		contentJSON,
	)
	return err
}

func (r *DocumentVersionRepository) ListVersions(ctx context.Context, documentID string, limit int, offset int) ([]model.DocumentVersion, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM document_versions WHERE document_id = $1", documentID).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get organization ID first
	var orgID string
	if err := r.db.QueryRowContext(ctx, "SELECT organization_id FROM documents WHERE id = $1", documentID).Scan(&orgID); err != nil {
		if err == sql.ErrNoRows {
			return []model.DocumentVersion{}, 0, nil
		}
		return nil, 0, err
	}

	const query = `
		SELECT document_id, version_number, title, category, status, changed_by_user_id, 
		       changed_by_user_id AS changed_by_user_name, 
		       change_summary, created_at, object_key, object_version_id, content_document_json
		FROM document_versions
		WHERE document_id = $1
		ORDER BY version_number DESC
		LIMIT $2 OFFSET $3
	`
	rows, err := r.db.QueryContext(ctx, query, documentID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]model.DocumentVersion, 0, limit)
	for rows.Next() {
		var item model.DocumentVersion
		var contentJSON []byte
		if err := rows.Scan(&item.DocumentID, &item.VersionNumber, &item.Title, &item.Category, &item.Status, &item.ChangedByUserID, &item.ChangedByUserName, &item.ChangeSummary, &item.CreatedAt, &item.ObjectKey, &item.ObjectVersionID, &contentJSON); err != nil {
			return nil, 0, err
		}
		content, err := unmarshalContentDocument(contentJSON)
		if err != nil {
			return nil, 0, err
		}
		item.ContentDocument = content
		
		// Resolve changed by user name if empty
		if strings.TrimSpace(item.ChangedByUserName) == "" || item.ChangedByUserName == item.ChangedByUserID {
			if resolved := resolveNameByUserID(ctx, r.db, orgID, item.ChangedByUserID); resolved != "" {
				item.ChangedByUserName = resolved
			}
		}
		
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (r *DocumentVersionRepository) GetVersion(ctx context.Context, documentID string, versionNumber int64) (model.DocumentVersion, error) {
	// Get organization ID first
	var orgID string
	if err := r.db.QueryRowContext(ctx, "SELECT organization_id FROM documents WHERE id = $1", documentID).Scan(&orgID); err != nil {
		if err == sql.ErrNoRows {
			return model.DocumentVersion{}, model.ErrDocumentNotFound
		}
		return model.DocumentVersion{}, err
	}

	const query = `
		SELECT document_id, version_number, title, category, status, changed_by_user_id, 
		       changed_by_user_id AS changed_by_user_name, 
		       change_summary, created_at, object_key, object_version_id, content_document_json
		FROM document_versions
		WHERE document_id = $1 AND version_number = $2
	`
	var item model.DocumentVersion
	var contentJSON []byte
	if err := r.db.QueryRowContext(ctx, query, documentID, versionNumber).Scan(&item.DocumentID, &item.VersionNumber, &item.Title, &item.Category, &item.Status, &item.ChangedByUserID, &item.ChangedByUserName, &item.ChangeSummary, &item.CreatedAt, &item.ObjectKey, &item.ObjectVersionID, &contentJSON); err != nil {
		if err == sql.ErrNoRows {
			return model.DocumentVersion{}, model.ErrDocumentNotFound
		}
		return model.DocumentVersion{}, err
	}
	contentFallback, err := unmarshalContentDocument(contentJSON)
	if err != nil {
		return model.DocumentVersion{}, err
	}
	
	// Resolve changed by user name if empty
	if strings.TrimSpace(item.ChangedByUserName) == "" || item.ChangedByUserName == item.ChangedByUserID {
		if resolved := resolveNameByUserID(ctx, r.db, orgID, item.ChangedByUserID); resolved != "" {
			item.ChangedByUserName = resolved
		}
	}
	
	content, err := r.LoadContent(ctx, item.ObjectKey, item.ObjectVersionID)
	if err != nil {
		item.ContentDocument = contentFallback
		return item, nil
	}
	item.ContentDocument = content
	return item, nil
}
