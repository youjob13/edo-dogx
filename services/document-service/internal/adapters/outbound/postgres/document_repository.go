package postgres

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"

	"github.com/minio/minio-go/v7"
)

type DocumentRepository struct {
	db            *sql.DB
	objectClient  *minio.Client
	presignClient *minio.Client
	bucketName    string
	presignedTTL  time.Duration
	versions      *DocumentVersionRepository
}

const defaultDocumentOrganizationID = "org-main"

func NewDocumentRepository(db *sql.DB, objectClient *minio.Client, presignClient *minio.Client, bucketName string, presignedTTL time.Duration) *DocumentRepository {
	if presignedTTL <= 0 {
		presignedTTL = 15 * time.Minute
	}
	if presignClient == nil {
		presignClient = objectClient
	}

	return &DocumentRepository{
		db:            db,
		objectClient:  objectClient,
		presignClient: presignClient,
		bucketName:    bucketName,
		presignedTTL:  presignedTTL,
		versions:      NewDocumentVersionRepository(db, objectClient, bucketName),
	}
}

func (r *DocumentRepository) CreateDraft(ctx context.Context, document model.Document) (model.Document, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return model.Document{}, err
	}
	defer tx.Rollback()

	const query = `
		INSERT INTO documents (title, category, organization_id, status, owner_user_id, owner_user_name, current_version_number)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`
	organizationID, err := resolveActorOrganizationIDTx(ctx, tx, document.OwnerUser)
	if err != nil {
		return model.Document{}, err
	}
	document.OrganizationID = organizationID
	row := tx.QueryRowContext(
		ctx,
		query,
		document.Title,
		document.Category,
		document.OrganizationID,
		string(document.Status),
		document.OwnerUser,
		document.OwnerUserName,
		1,
	)
	if err := row.Scan(&document.ID, &document.CreatedAt, &document.UpdatedAt); err != nil {
		return model.Document{}, err
	}

	objectKey := buildDocumentContentKey(document.ID)
	objectVersionID, err := r.versions.StoreContent(ctx, objectKey, document.ContentDocument)
	if err != nil {
		return model.Document{}, err
	}
	if err := r.versions.AppendVersionTx(ctx, tx, model.DocumentVersion{
		DocumentID:      document.ID,
		VersionNumber:   1,
		Title:           document.Title,
		Category:        document.Category,
		Status:          document.Status,
		ChangedByUserID: document.OwnerUser,
		ChangeSummary:   "document draft created",
		ObjectKey:       objectKey,
		ObjectVersionID: objectVersionID,
	}); err != nil {
		return model.Document{}, err
	}

	const headUpdate = `
		UPDATE documents
		SET current_object_key = $2, current_object_version_id = $3, updated_at = NOW()
		WHERE id = $1
	`
	if _, err := tx.ExecContext(ctx, headUpdate, document.ID, objectKey, objectVersionID); err != nil {
		return model.Document{}, err
	}

	if err := tx.Commit(); err != nil {
		return model.Document{}, err
	}

	document.Version = 1
	document.ObjectKey = objectKey
	document.ObjectVersionID = objectVersionID
	return document, nil
}

func (r *DocumentRepository) GetByID(ctx context.Context, id string) (model.Document, error) {
	document, err := r.loadDocumentByID(ctx, r.db, id)
	if err != nil {
		return model.Document{}, err
	}
	content, err := r.versions.LoadContent(ctx, document.ObjectKey, document.ObjectVersionID)
	if err != nil {
		return model.Document{}, err
	}
	document.ContentDocument = content
	return document, nil
}

func (r *DocumentRepository) GetAccessibleByID(ctx context.Context, id string, actorUserID string) (model.Document, error) {
	document, err := r.GetByID(ctx, id)
	if err != nil {
		return model.Document{}, err
	}
	allowed, err := r.actorCanAccessOrganization(ctx, document.OrganizationID, actorUserID)
	if err != nil {
		return model.Document{}, err
	}
	if !allowed && document.OwnerUser != actorUserID {
		return model.Document{}, model.ErrDocumentAccessDenied
	}
	return document, nil
}

func (r *DocumentRepository) loadDocumentByID(ctx context.Context, querier rowQuerier, id string) (model.Document, error) {
	const query = `
		SELECT id, title, category, organization_id, status, owner_user_id, COALESCE(owner_user_name, owner_user_id) AS owner_user_name, current_version_number, current_object_key, current_object_version_id, created_at, updated_at
		FROM documents
		WHERE id = $1
	`

	var document model.Document
	if err := querier.QueryRowContext(ctx, query, id).Scan(
		&document.ID,
		&document.Title,
		&document.Category,
		&document.OrganizationID,
		&document.Status,
		&document.OwnerUser,
		&document.OwnerUserName,
		&document.Version,
		&document.ObjectKey,
		&document.ObjectVersionID,
		&document.CreatedAt,
		&document.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.Document{}, model.ErrDocumentNotFound
		}
		return model.Document{}, err
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
		SELECT id, title, category, organization_id, status, owner_user_id, COALESCE(owner_user_name, owner_user_id) AS owner_user_name, current_version_number, current_object_key, current_object_version_id, created_at, updated_at
		FROM documents
		WHERE id = $1
		FOR UPDATE
	`

	var current model.Document
	if err := tx.QueryRowContext(ctx, selectQuery, input.DocumentID).Scan(
		&current.ID,
		&current.Title,
		&current.Category,
		&current.OrganizationID,
		&current.Status,
		&current.OwnerUser,
		&current.OwnerUserName,
		&current.Version,
		&current.ObjectKey,
		&current.ObjectVersionID,
		&current.CreatedAt,
		&current.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return model.Document{}, model.ErrDocumentNotFound
		}
		return model.Document{}, err
	}
	content, err := r.versions.LoadContent(ctx, current.ObjectKey, current.ObjectVersionID)
	if err != nil {
		return model.Document{}, err
	}
	if current.OwnerUser != input.ActorUserID {
		return model.Document{}, model.ErrDocumentAccessDenied
	}
	allowed, err := actorCanAccessOrganizationTx(ctx, tx, current.OrganizationID, input.ActorUserID)
	if err != nil {
		return model.Document{}, err
	}
	if !allowed {
		return model.Document{}, model.ErrDocumentAccessDenied
	}
	current.ContentDocument = content
	newContent := current.ContentDocument
	if input.ContentDocument != nil {
		newContent = input.ContentDocument
	}
	if current.Version != input.ExpectedVersion {
		return model.Document{}, model.NewVersionConflictError(input.ExpectedVersion, current.Version)
	}
	if !current.Status.IsEditable() {
		return model.Document{}, model.ErrDocumentNotEditable
	}
	newVersion := current.Version + 1
	objectVersionID, err := r.versions.StoreContent(ctx, current.ObjectKey, newContent)
	if err != nil {
		return model.Document{}, err
	}

	const updateQuery = `
		UPDATE documents
		SET title = $2, current_version_number = $3, current_object_key = $4, current_object_version_id = $5, updated_at = $6
		WHERE id = $1
		RETURNING updated_at
	`

	updatedAt := time.Now().UTC().Format(time.RFC3339)
	if err := tx.QueryRowContext(ctx, updateQuery, current.ID, input.Title, newVersion, current.ObjectKey, objectVersionID, updatedAt).Scan(&current.UpdatedAt); err != nil {
		return model.Document{}, err
	}
	if err := r.versions.AppendVersionTx(ctx, tx, model.DocumentVersion{
		DocumentID:      current.ID,
		VersionNumber:   newVersion,
		Title:           input.Title,
		Category:        current.Category,
		Status:          current.Status,
		ChangedByUserID: input.ActorUserID,
		ChangeSummary:   "updated by " + input.ActorUserID,
		ObjectKey:       current.ObjectKey,
		ObjectVersionID: objectVersionID,
	}); err != nil {
		return model.Document{}, err
	}

	if err := tx.Commit(); err != nil {
		return model.Document{}, err
	}

	current.Title = input.Title
	current.ContentDocument = newContent
	current.Version = newVersion
	current.ObjectVersionID = objectVersionID
	return current, nil
}

func (r *DocumentRepository) SearchDocuments(ctx context.Context, input outbound.SearchDocumentsInput) ([]model.Document, int64, error) {
	if input.Limit <= 0 {
		input.Limit = 20
	}
	if input.Offset < 0 {
		input.Offset = 0
	}

	where := "WHERE true"
	args := make([]any, 0, 6)
	argIdx := 1

	if strings.TrimSpace(input.ActorUserID) == "" {
		return []model.Document{}, 0, nil
	}
	where += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = documents.organization_id AND om.user_id = $%d)", argIdx)
	args = append(args, input.ActorUserID)
	argIdx++

	if input.Query != "" {
		where += fmt.Sprintf(" AND (title ILIKE $%d OR category ILIKE $%d)", argIdx, argIdx+1)
		args = append(args, "%"+input.Query+"%", "%"+input.Query+"%")
		argIdx += 2
	}

	if input.Category != "" {
		where += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, input.Category)
		argIdx++
	}

	var total int64
	totalQuery := fmt.Sprintf("SELECT COUNT(*) FROM documents %s", where)
	if err := r.db.QueryRowContext(ctx, totalQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(`
		SELECT id, title, category, organization_id, status, owner_user_id, COALESCE(owner_user_name, owner_user_id) AS owner_user_name, current_version_number, current_object_key, current_object_version_id, created_at, updated_at
		FROM documents
		%s
		ORDER BY updated_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, input.Limit, input.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	documents := make([]model.Document, 0)
	for rows.Next() {
		var document model.Document
		if err := rows.Scan(
			&document.ID,
			&document.Title,
			&document.Category,
			&document.OrganizationID,
			&document.Status,
			&document.OwnerUser,
			&document.OwnerUserName,
			&document.Version,
			&document.ObjectKey,
			&document.ObjectVersionID,
			&document.CreatedAt,
			&document.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		documents = append(documents, document)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return documents, total, nil
}

type rowQuerier interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func resolveActorOrganizationIDTx(ctx context.Context, tx *sql.Tx, actorUserID string) (string, error) {
	var organizationID string
	err := tx.QueryRowContext(ctx, `
		SELECT organization_id
		FROM organization_members
		WHERE user_id = $1
		ORDER BY CASE WHEN organization_id = $2 THEN 0 ELSE 1 END, organization_id
		LIMIT 1
	`, actorUserID, defaultDocumentOrganizationID).Scan(&organizationID)
	if err == sql.ErrNoRows {
		return defaultDocumentOrganizationID, nil
	}
	return organizationID, err
}

func actorCanAccessOrganizationTx(ctx context.Context, tx *sql.Tx, organizationID string, actorUserID string) (bool, error) {
	if strings.TrimSpace(actorUserID) == "" || strings.TrimSpace(organizationID) == "" {
		return false, nil
	}
	var exists bool
	err := tx.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM organization_members
			WHERE organization_id = $1 AND user_id = $2
		)
	`, organizationID, actorUserID).Scan(&exists)
	return exists, err
}

func (r *DocumentRepository) actorCanAccessOrganization(ctx context.Context, organizationID string, actorUserID string) (bool, error) {
	if strings.TrimSpace(actorUserID) == "" || strings.TrimSpace(organizationID) == "" {
		return false, nil
	}
	var exists bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM organization_members
			WHERE organization_id = $1 AND user_id = $2
		)
	`, organizationID, actorUserID).Scan(&exists)
	return exists, err
}

func (r *DocumentRepository) ListVersions(ctx context.Context, documentID string, limit int, offset int) ([]model.DocumentVersion, int64, error) {
	return r.versions.ListVersions(ctx, documentID, limit, offset)
}

func (r *DocumentRepository) GetVersion(ctx context.Context, documentID string, versionNumber int64) (model.DocumentVersion, error) {
	return r.versions.GetVersion(ctx, documentID, versionNumber)
}

func (r *DocumentRepository) GetEditorControlProfileByContext(ctx context.Context, contextType string, contextKey string) (model.EditorControlProfile, error) {
	const query = `
		SELECT id, context_type, context_key, enabled_controls, disabled_controls, is_active, updated_by_user_id, updated_at
		FROM editor_control_profiles
		WHERE context_type = $1 AND context_key = $2
	`

	slog.Info("query editor control profile by context",
		"contextType", contextType,
		"contextKey", contextKey,
	)

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
			fallbackProfile := model.EditorControlProfile{
				ID:          contextType + ":" + contextKey,
				ContextType: contextType,
				ContextKey:  contextKey,
				EnabledControls: []string{"bold",
					"italic", "heading", "list", "table", "link", "image"},
				DisabledControls: []string{},
				IsActive:         true,
				UpdatedByUserID:  "system",
				UpdatedAt:        "2026-01-01T00:00:00Z",
			}

			slog.Info("editor control profile not found, using fallback",
				"contextType", contextType,
				"contextKey", contextKey,
				"profileId", fallbackProfile.ID,
			)

			return fallbackProfile, nil
		}

		slog.Error("query editor control profile failed",
			"contextType", contextType,
			"contextKey", contextKey,
			"err", err,
		)
		return model.EditorControlProfile{}, err
	}

	if err := json.Unmarshal(enabledRaw, &profile.EnabledControls); err != nil {
		slog.Error("failed to decode enabled editor controls",
			"profileId", profile.ID,
			"contextType", profile.ContextType,
			"contextKey", profile.ContextKey,
			"err", err,
		)
		return model.EditorControlProfile{}, err
	}
	if err := json.Unmarshal(disabledRaw, &profile.DisabledControls); err != nil {
		slog.Error("failed to decode disabled editor controls",
			"profileId", profile.ID,
			"contextType", profile.ContextType,
			"contextKey", profile.ContextKey,
			"err", err,
		)
		return model.EditorControlProfile{}, err
	}

	slog.Info("editor control profile loaded",
		"profileId", profile.ID,
		"contextType", profile.ContextType,
		"contextKey", profile.ContextKey,
		"isActive", profile.IsActive,
	)

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

	slog.Info("insert export request started",
		"documentId", input.DocumentID,
		"requestedByUser", input.RequestedByUser,
		"format", input.Format,
		"sourceVersion", input.SourceVersion,
	)

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
		slog.Error("insert export request failed",
			"documentId", input.DocumentID,
			"requestedByUser", input.RequestedByUser,
			"format", input.Format,
			"sourceVersion", input.SourceVersion,
			"err", err,
		)
		return model.ExportRequest{}, err
	}

	slog.Info("insert export request succeeded",
		"exportRequestId", request.ID,
		"documentId", request.DocumentID,
		"status", request.Status,
	)

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
	var errorCode sql.NullString
	var errorMessage sql.NullString
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
		&errorCode,
		&errorMessage,
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
	request.ErrorCode = errorCode.String
	request.ErrorMessage = errorMessage.String
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
	var errorCode sql.NullString
	var errorMessage sql.NullString
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
		&errorCode,
		&errorMessage,
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
	request.ErrorCode = errorCode.String
	request.ErrorMessage = errorMessage.String
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

	presignedURL, err := r.presignClient.PresignedGetObject(ctx, r.bucketName, storageKey, r.presignedTTL, query)
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
