package postgres

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"

	"github.com/minio/minio-go/v7"
)

type DocumentRepository struct {
	db           *sql.DB
	objectClient *minio.Client
	bucketName   string
	presignedTTL time.Duration
}

func NewDocumentRepository(db *sql.DB, objectClient *minio.Client, bucketName string, presignedTTL time.Duration) *DocumentRepository {
	if presignedTTL <= 0 {
		presignedTTL = 15 * time.Minute
	}

	return &DocumentRepository{db: db, objectClient: objectClient, bucketName: bucketName, presignedTTL: presignedTTL}
}

func (r *DocumentRepository) CreateDraft(ctx context.Context, document model.Document) (model.Document, error) {
	content, err := json.Marshal(document.ContentDocument)
	if err != nil {
		return model.Document{}, err
	}

	const query = `
		INSERT INTO documents (title, category, status, content_document_json, owner_user_id, version)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, updated_at
	`

	row := r.db.QueryRowContext(ctx, query, document.Title, document.Category, string(document.Status), content, document.OwnerUser, document.Version)
	if err := row.Scan(&document.ID, &document.UpdatedAt); err != nil {
		return model.Document{}, err
	}

	return document, nil
}

func (r *DocumentRepository) GetByID(ctx context.Context, id string) (model.Document, error) {
	const query = `
		SELECT id, title, category, status, content_document_json, owner_user_id, version, updated_at
		FROM documents
		WHERE id = $1
	`

	var document model.Document
	var status string
	var contentRaw []byte
	if err := r.db.QueryRowContext(ctx, query, id).Scan(
		&document.ID,
		&document.Title,
		&document.Category,
		&status,
		&contentRaw,
		&document.OwnerUser,
		&document.Version,
		&document.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.Document{}, model.ErrDocumentNotFound
		}
		return model.Document{}, err
	}

	document.Status = model.DocumentStatus(status)
	if len(contentRaw) > 0 {
		if err := json.Unmarshal(contentRaw, &document.ContentDocument); err != nil {
			return model.Document{}, err
		}
	}
	return document, nil
}

func (r *DocumentRepository) UpdateDraft(ctx context.Context, input outbound.UpdateDraftInput) (model.Document, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.Document{}, err
	}
	defer tx.Rollback()

	const selectQuery = `
		SELECT id, title, category, status, content_document_json, owner_user_id, version, updated_at
		FROM documents
		WHERE id = $1
		FOR UPDATE
	`

	var current model.Document
	var status string
	var contentRaw []byte
	if err := tx.QueryRowContext(ctx, selectQuery, input.DocumentID).Scan(
		&current.ID,
		&current.Title,
		&current.Category,
		&status,
		&contentRaw,
		&current.OwnerUser,
		&current.Version,
		&current.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.Document{}, model.ErrDocumentNotFound
		}
		return model.Document{}, err
	}
	current.Status = model.DocumentStatus(status)
	if len(contentRaw) > 0 {
		if err := json.Unmarshal(contentRaw, &current.ContentDocument); err != nil {
			return model.Document{}, err
		}
	}

	if current.Version != input.ExpectedVersion {
		return model.Document{}, model.NewVersionConflictError(input.ExpectedVersion, current.Version)
	}
	if !current.Status.IsEditable() {
		return model.Document{}, model.ErrDocumentNotEditable
	}

	newContent := current.ContentDocument
	if input.ContentDocument != nil {
		newContent = input.ContentDocument
	}
	content, err := json.Marshal(newContent)
	if err != nil {
		return model.Document{}, err
	}

	newVersion := current.Version + 1
	const updateQuery = `
		UPDATE documents
		SET title = $2, content_document_json = $3, version = $4, updated_at = $5
		WHERE id = $1
		RETURNING updated_at
	`

	updatedAt := time.Now().UTC().Format(time.RFC3339)
	if err := tx.QueryRowContext(ctx, updateQuery, current.ID, input.Title, content, newVersion, updatedAt).Scan(&current.UpdatedAt); err != nil {
		return model.Document{}, err
	}

	const versionQuery = `
		INSERT INTO document_versions (document_id, version_number, title, category, status, changed_by_user_id, change_summary, content_document_json)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	if _, err := tx.ExecContext(ctx, versionQuery, current.ID, newVersion, input.Title, current.Category, string(current.Status), input.ActorUserID, fmt.Sprintf("title updated by %s", input.ActorUserID), content); err != nil {
		return model.Document{}, err
	}

	if err := tx.Commit(); err != nil {
		return model.Document{}, err
	}

	current.Title = input.Title
	current.ContentDocument = newContent
	current.Version = newVersion
	return current, nil
}

func (r *DocumentRepository) GetEditorControlProfileByContext(ctx context.Context, contextType string, contextKey string) (model.EditorControlProfile, error) {
	const query = `
		SELECT id, context_type, context_key, enabled_controls, disabled_controls, is_active, updated_by_user_id, updated_at
		FROM editor_control_profiles
		WHERE context_type = $1 AND context_key = $2
	`

	var profile model.EditorControlProfile
	var enabledRaw []byte
	var disabledRaw []byte
	if err := r.db.QueryRowContext(ctx, query, contextType, contextKey).Scan(
		&profile.ID,
		&profile.ContextType,
		&profile.ContextKey,
		&enabledRaw,
		&disabledRaw,
		&profile.IsActive,
		&profile.UpdatedByUserID,
		&profile.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.EditorControlProfile{
				ID:               contextType + ":" + contextKey,
				ContextType:      contextType,
				ContextKey:       contextKey,
				EnabledControls:  []string{"bold", "italic", "heading", "list", "table", "link", "image"},
				DisabledControls: []string{},
				IsActive:         true,
				UpdatedByUserID:  "system",
				UpdatedAt:        "2026-01-01T00:00:00Z",
			}, nil
		}
		return model.EditorControlProfile{}, err
	}

	if err := json.Unmarshal(enabledRaw, &profile.EnabledControls); err != nil {
		return model.EditorControlProfile{}, err
	}
	if err := json.Unmarshal(disabledRaw, &profile.DisabledControls); err != nil {
		return model.EditorControlProfile{}, err
	}

	return profile, nil
}

func (r *DocumentRepository) UpdateEditorControlProfile(ctx context.Context, input outbound.UpdateEditorControlProfileInput) (model.EditorControlProfile, error) {
	enabled, err := json.Marshal(input.EnabledControls)
	if err != nil {
		return model.EditorControlProfile{}, err
	}
	disabled, err := json.Marshal(input.DisabledControls)
	if err != nil {
		return model.EditorControlProfile{}, err
	}

	if input.ProfileID != "" {
		const updateQuery = `
			UPDATE editor_control_profiles
			SET enabled_controls = $2,
				disabled_controls = $3,
				is_active = $4,
				updated_by_user_id = $5,
				updated_at = NOW()
			WHERE id = $1
			RETURNING id, context_type, context_key, enabled_controls, disabled_controls, is_active, updated_by_user_id, updated_at
		`

		var profile model.EditorControlProfile
		var enabledRaw []byte
		var disabledRaw []byte
		if err := r.db.QueryRowContext(ctx, updateQuery, input.ProfileID, enabled, disabled, input.IsActive, input.UpdatedByUserID).Scan(
			&profile.ID,
			&profile.ContextType,
			&profile.ContextKey,
			&enabledRaw,
			&disabledRaw,
			&profile.IsActive,
			&profile.UpdatedByUserID,
			&profile.UpdatedAt,
		); err != nil {
			return model.EditorControlProfile{}, err
		}

		if err := json.Unmarshal(enabledRaw, &profile.EnabledControls); err != nil {
			return model.EditorControlProfile{}, err
		}
		if err := json.Unmarshal(disabledRaw, &profile.DisabledControls); err != nil {
			return model.EditorControlProfile{}, err
		}

		return profile, nil
	}

	const upsertQuery = `
		INSERT INTO editor_control_profiles (
			context_type, context_key, enabled_controls, disabled_controls, is_active, updated_by_user_id
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (context_type, context_key)
		DO UPDATE SET
			enabled_controls = EXCLUDED.enabled_controls,
			disabled_controls = EXCLUDED.disabled_controls,
			is_active = EXCLUDED.is_active,
			updated_by_user_id = EXCLUDED.updated_by_user_id,
			updated_at = NOW()
		RETURNING id, context_type, context_key, enabled_controls, disabled_controls, is_active, updated_by_user_id, updated_at
	`

	var profile model.EditorControlProfile
	var enabledRaw []byte
	var disabledRaw []byte
	if err := r.db.QueryRowContext(ctx, upsertQuery, input.FallbackType, input.FallbackContextID, enabled, disabled, input.IsActive, input.UpdatedByUserID).Scan(
		&profile.ID,
		&profile.ContextType,
		&profile.ContextKey,
		&enabledRaw,
		&disabledRaw,
		&profile.IsActive,
		&profile.UpdatedByUserID,
		&profile.UpdatedAt,
	); err != nil {
		return model.EditorControlProfile{}, err
	}

	if err := json.Unmarshal(enabledRaw, &profile.EnabledControls); err != nil {
		return model.EditorControlProfile{}, err
	}
	if err := json.Unmarshal(disabledRaw, &profile.DisabledControls); err != nil {
		return model.EditorControlProfile{}, err
	}

	return profile, nil
}

func (r *DocumentRepository) CreateExportRequest(ctx context.Context, input outbound.CreateExportRequestInput) (model.ExportRequest, error) {
	const query = `
		INSERT INTO export_requests (document_id, requested_by_user_id, target_format, source_version, status)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`

	request := model.ExportRequest{
		DocumentID:      input.DocumentID,
		RequestedByUser: input.RequestedByUser,
		Format:          input.Format,
		SourceVersion:   input.SourceVersion,
		Status:          model.ExportRequestStatusQueued,
	}
	if err := r.db.QueryRowContext(ctx, query, input.DocumentID, input.RequestedByUser, string(input.Format), input.SourceVersion, string(model.ExportRequestStatusQueued)).Scan(
		&request.ID,
		&request.CreatedAt,
		&request.UpdatedAt,
	); err != nil {
		return model.ExportRequest{}, err
	}

	return request, nil
}

func (r *DocumentRepository) CompleteExportRequestSuccess(ctx context.Context, input outbound.CompleteExportRequestSuccessInput) (model.ExportRequest, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.ExportRequest{}, err
	}
	defer tx.Rollback()

	storageKey := fmt.Sprintf("exports/%s/%s/%s", input.DocumentID, input.ExportRequestID, input.FileName)
	if err := r.storeArtifactPayload(ctx, storageKey, input.MIMEType, input.DataBase64); err != nil {
		return model.ExportRequest{}, err
	}

	const artifactQuery = `
		INSERT INTO export_artifacts (
			export_request_id, document_id, format, storage_key, file_name, mime_type, size_bytes, checksum
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`

	artifact := model.ExportArtifact{}
	if err := tx.QueryRowContext(
		ctx,
		artifactQuery,
		input.ExportRequestID,
		input.DocumentID,
		string(input.Format),
		storageKey,
		input.FileName,
		input.MIMEType,
		input.SizeBytes,
		input.Checksum,
	).Scan(&artifact.ID, &artifact.CreatedAt); err != nil {
		return model.ExportRequest{}, err
	}

	const updateQuery = `
		UPDATE export_requests
		SET status = $3, artifact_id = $4, updated_at = NOW()
		WHERE id = $1 AND document_id = $2
		RETURNING id, document_id, requested_by_user_id, target_format, source_version, status, error_code, error_message, created_at, updated_at
	`

	var request model.ExportRequest
	var format string
	var status string
	if err := tx.QueryRowContext(
		ctx,
		updateQuery,
		input.ExportRequestID,
		input.DocumentID,
		string(model.ExportRequestStatusSucceeded),
		artifact.ID,
	).Scan(
		&request.ID,
		&request.DocumentID,
		&request.RequestedByUser,
		&format,
		&request.SourceVersion,
		&status,
		&request.ErrorCode,
		&request.ErrorMessage,
		&request.CreatedAt,
		&request.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.ExportRequest{}, model.ErrDocumentNotFound
		}
		return model.ExportRequest{}, err
	}

	if err := tx.Commit(); err != nil {
		return model.ExportRequest{}, err
	}

	artifact.FileName = input.FileName
	artifact.MIMEType = input.MIMEType
	artifact.SizeBytes = input.SizeBytes
	request.Format = model.ExportFormat(format)
	request.Status = model.ExportRequestStatus(status)
	request.Artifact = &artifact

	return request, nil
}

func (r *DocumentRepository) GetExportRequest(ctx context.Context, documentID string, exportRequestID string) (model.ExportRequest, error) {
	const query = `
		SELECT
			er.id,
			er.document_id,
			er.requested_by_user_id,
			er.target_format,
			er.source_version,
			er.status,
			er.error_code,
			er.error_message,
			er.created_at,
			er.updated_at,
			ea.id,
			ea.file_name,
			ea.mime_type,
			ea.size_bytes,
			ea.created_at
		FROM export_requests er
		LEFT JOIN export_artifacts ea ON ea.id = er.artifact_id
		WHERE er.document_id = $1 AND er.id = $2
	`

	var request model.ExportRequest
	var format string
	var status string
	var artifactID sql.NullString
	var artifactFileName sql.NullString
	var artifactMIME sql.NullString
	var artifactSize sql.NullInt64
	var artifactCreatedAt sql.NullString
	if err := r.db.QueryRowContext(ctx, query, documentID, exportRequestID).Scan(
		&request.ID,
		&request.DocumentID,
		&request.RequestedByUser,
		&format,
		&request.SourceVersion,
		&status,
		&request.ErrorCode,
		&request.ErrorMessage,
		&request.CreatedAt,
		&request.UpdatedAt,
		&artifactID,
		&artifactFileName,
		&artifactMIME,
		&artifactSize,
		&artifactCreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.ExportRequest{}, model.ErrDocumentNotFound
		}
		return model.ExportRequest{}, err
	}

	request.Format = model.ExportFormat(format)
	request.Status = model.ExportRequestStatus(status)
	if artifactID.Valid {
		request.Artifact = &model.ExportArtifact{
			ID:        artifactID.String,
			FileName:  artifactFileName.String,
			MIMEType:  artifactMIME.String,
			SizeBytes: artifactSize.Int64,
			CreatedAt: artifactCreatedAt.String,
		}
	}
	return request, nil
}

func (r *DocumentRepository) GetExportArtifact(ctx context.Context, documentID string, exportRequestID string) (model.ExportArtifact, error) {
	const query = `
		SELECT ea.id, ea.file_name, ea.mime_type, ea.size_bytes, ea.created_at, ea.storage_key
		FROM export_artifacts ea
		JOIN export_requests er ON er.artifact_id = ea.id
		WHERE er.document_id = $1 AND er.id = $2
	`

	var artifact model.ExportArtifact
	var storageKey string
	if err := r.db.QueryRowContext(ctx, query, documentID, exportRequestID).Scan(
		&artifact.ID,
		&artifact.FileName,
		&artifact.MIMEType,
		&artifact.SizeBytes,
		&artifact.CreatedAt,
		&storageKey,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.ExportArtifact{}, model.ErrDocumentNotFound
		}
		return model.ExportArtifact{}, err
	}

	if storageKey == "" {
		return model.ExportArtifact{}, fmt.Errorf("export artifact has empty storage key")
	}

	downloadURL, err := r.presignArtifactURL(ctx, storageKey, artifact.FileName, artifact.MIMEType)
	if err != nil {
		return model.ExportArtifact{}, err
	}
	artifact.DownloadURL = downloadURL
	return artifact, nil

}

func (r *DocumentRepository) presignArtifactURL(ctx context.Context, storageKey string, fileName string, mimeType string) (string, error) {
	if r.objectClient == nil {
		return "", fmt.Errorf("object storage client is not configured")
	}

	query := make(url.Values)
	if mimeType != "" {
		query.Set("response-content-type", mimeType)
	}
	if fileName != "" {
		query.Set("response-content-disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileName))
	}

	presignedURL, err := r.objectClient.PresignedGetObject(ctx, r.bucketName, storageKey, r.presignedTTL, query)
	if err != nil {
		return "", err
	}

	return presignedURL.String(), nil
}

func (r *DocumentRepository) storeArtifactPayload(ctx context.Context, storageKey string, mimeType string, dataBase64 string) error {
	if r.objectClient == nil {
		return fmt.Errorf("object storage client is not configured")
	}

	payload, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		return err
	}

	_, err = r.objectClient.PutObject(
		ctx,
		r.bucketName,
		storageKey,
		bytes.NewReader(payload),
		int64(len(payload)),
		minio.PutObjectOptions{ContentType: mimeType},
	)
	return err
}
