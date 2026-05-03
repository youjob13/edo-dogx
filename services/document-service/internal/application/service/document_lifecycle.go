package service

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"
)

type DocumentLifecycleService struct {
	documents outbound.DocumentRepository
	versions  outbound.DocumentVersionRepository
}

func NewDocumentLifecycleService(
	documents outbound.DocumentRepository,
	versions outbound.DocumentVersionRepository,
) *DocumentLifecycleService {
	return &DocumentLifecycleService{documents: documents, versions: versions}
}

type CreateDraftInput struct {
	ActorUserID     string
	Title           string
	Category        string
	ContentDocument map[string]any
}

type UpdateDraftInput struct {
	ActorUserID     string
	DocumentID      string
	Title           string
	ExpectedVersion int64
	ContentDocument map[string]any
}

type GetEditorControlProfileInput struct {
	ActorUserID string
	ContextType string
	ContextKey  string
}

type UpdateEditorControlProfileInput struct {
	ActorUserID      string
	ProfileID        string
	ContextType      string
	ContextKey       string
	EnabledControls  []string
	DisabledControls []string
	IsActive         bool
}

type CreateExportRequestInput struct {
	ActorUserID   string
	DocumentID    string
	Format        model.ExportFormat
	SourceVersion int64
}

type GetExportRequestInput struct {
	ActorUserID     string
	DocumentID      string
	ExportRequestID string
}

type DownloadExportArtifactInput struct {
	ActorUserID     string
	DocumentID      string
	ExportRequestID string
}

type GetDocumentInput struct {
	ActorUserID string
	DocumentID  string
}

type SearchDocumentsInput struct {
	ActorUserID string
	Query       string
	Status      model.DocumentStatus
	Category    string
	Limit       int
	Offset      int
}

func NewInMemoryDocumentLifecycleService() *DocumentLifecycleService {
	return NewDocumentLifecycleService(
		newInMemoryDocumentRepository(),
		newInMemoryDocumentVersionRepository(),
	)
}

func (s *DocumentLifecycleService) CreateDraft(ctx context.Context, input CreateDraftInput) (model.Document, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" || len(title) > 300 {
		return model.Document{}, model.ErrInvalidDocumentTitle
	}
	contentDocument := input.ContentDocument
	if contentDocument == nil {
		contentDocument = map[string]any{
			"type":    "doc",
			"content": []map[string]any{{"type": "paragraph"}},
		}
	}
	if _, ok := contentDocument["type"]; !ok {
		return model.Document{}, model.ErrInvalidDocumentContent
	}

	document := model.Document{
		Title:           title,
		Category:        input.Category,
		Status:          model.DocumentStatusDraft,
		ContentDocument: contentDocument,
		OwnerUser:       input.ActorUserID,
		Version:         1,
		UpdatedAt:       time.Now().UTC().Format(time.RFC3339),
	}

	created, err := s.documents.CreateDraft(ctx, document)
	if err != nil {
		return model.Document{}, err
	}

	if err := s.versions.AppendVersion(ctx, created, input.ActorUserID, "document draft created"); err != nil {
		return model.Document{}, err
	}

	return created, nil
}

func (s *DocumentLifecycleService) UpdateDraft(ctx context.Context, input UpdateDraftInput) (model.Document, error) {
	if input.ExpectedVersion <= 0 {
		return model.Document{}, model.NewVersionConflictError(input.ExpectedVersion, 0)
	}
	title := strings.TrimSpace(input.Title)
	if title == "" || len(title) > 300 {
		return model.Document{}, model.ErrInvalidDocumentTitle
	}
	if input.ContentDocument != nil {
		if _, ok := input.ContentDocument["type"]; !ok {
			return model.Document{}, model.ErrInvalidDocumentContent
		}
	}

	updated, err := s.documents.UpdateDraft(ctx, outbound.UpdateDraftInput{
		DocumentID:      input.DocumentID,
		ExpectedVersion: input.ExpectedVersion,
		Title:           title,
		ContentDocument: input.ContentDocument,
		ActorUserID:     input.ActorUserID,
	})
	if err != nil {
		return model.Document{}, err
	}

	return updated, nil
}

func (s *DocumentLifecycleService) GetDocument(ctx context.Context, input GetDocumentInput) (model.Document, error) {
	_ = input.ActorUserID
	return s.documents.GetByID(ctx, input.DocumentID)
}

func (s *DocumentLifecycleService) SearchDocuments(ctx context.Context, input SearchDocumentsInput) ([]model.Document, int64, error) {
	return s.documents.SearchDocuments(ctx, outbound.SearchDocumentsInput{
		Query:    input.Query,
		Status:   input.Status,
		Category: input.Category,
		Limit:    input.Limit,
		Offset:   input.Offset,
	})
}

func (s *DocumentLifecycleService) GetEditorControlProfile(ctx context.Context, input GetEditorControlProfileInput) (model.EditorControlProfile, error) {
	slog.Info("get editor control profile requested",
		"actorUserId", input.ActorUserID,
		"contextType", input.ContextType,
		"contextKey", input.ContextKey,
	)

	profile, err := s.documents.GetEditorControlProfileByContext(ctx, input.ContextType, input.ContextKey)
	if err != nil {
		slog.Error("get editor control profile failed",
			"actorUserId", input.ActorUserID,
			"contextType", input.ContextType,
			"contextKey", input.ContextKey,
			"err", err,
		)
		return model.EditorControlProfile{}, err
	}

	slog.Info("get editor control profile succeeded",
		"actorUserId", input.ActorUserID,
		"profileId", profile.ID,
		"contextType", profile.ContextType,
		"contextKey", profile.ContextKey,
		"isActive", profile.IsActive,
	)

	return profile, nil
}

func (s *DocumentLifecycleService) UpdateEditorControlProfile(ctx context.Context, input UpdateEditorControlProfileInput) (model.EditorControlProfile, error) {
	return s.documents.UpdateEditorControlProfile(ctx, outbound.UpdateEditorControlProfileInput{
		ProfileID:         input.ProfileID,
		EnabledControls:   input.EnabledControls,
		DisabledControls:  input.DisabledControls,
		IsActive:          input.IsActive,
		UpdatedByUserID:   input.ActorUserID,
		FallbackType:      input.ContextType,
		FallbackContextID: input.ContextKey,
	})
}

func (s *DocumentLifecycleService) CreateExportRequest(ctx context.Context, input CreateExportRequestInput) (model.ExportRequest, error) {
	slog.Info("create export request started",
		"actorUserId", input.ActorUserID,
		"documentId", input.DocumentID,
		"format", input.Format,
		"sourceVersion", input.SourceVersion,
	)

	document, err := s.documents.GetByID(ctx, input.DocumentID)
	if err != nil {
		slog.Error("create export request failed to load document",
			"actorUserId", input.ActorUserID,
			"documentId", input.DocumentID,
			"err", err,
		)
		return model.ExportRequest{}, err
	}
	if document.Version != input.SourceVersion {
		slog.Error("create export request version conflict",
			"actorUserId", input.ActorUserID,
			"documentId", input.DocumentID,
			"sourceVersion", input.SourceVersion,
			"currentVersion", document.Version,
		)
		return model.ExportRequest{}, model.NewVersionConflictError(input.SourceVersion, document.Version)
	}

	request, err := s.documents.CreateExportRequest(ctx, outbound.CreateExportRequestInput{
		DocumentID:      input.DocumentID,
		RequestedByUser: input.ActorUserID,
		Format:          input.Format,
		SourceVersion:   input.SourceVersion,
	})
	if err != nil {
		slog.Error("create export request failed to persist request",
			"actorUserId", input.ActorUserID,
			"documentId", input.DocumentID,
			"format", input.Format,
			"sourceVersion", input.SourceVersion,
			"err", err,
		)
		return model.ExportRequest{}, err
	}

	artifact, err := buildExportArtifact(document, input.Format)
	if err != nil {
		slog.Error("create export request failed to build artifact",
			"exportRequestId", request.ID,
			"documentId", input.DocumentID,
			"format", input.Format,
			"err", err,
		)
		return model.ExportRequest{}, err
	}

	completed, err := s.documents.CompleteExportRequestSuccess(ctx, outbound.CompleteExportRequestSuccessInput{
		ExportRequestID: request.ID,
		DocumentID:      request.DocumentID,
		Format:          request.Format,
		FileName:        artifact.FileName,
		MIMEType:        artifact.MIMEType,
		SizeBytes:       artifact.SizeBytes,
		Checksum:        artifactChecksum(artifact.DataBase64),
		DataBase64:      artifact.DataBase64,
	})
	if err != nil {
		slog.Error("create export request failed to finalize request",
			"exportRequestId", request.ID,
			"documentId", request.DocumentID,
			"format", request.Format,
			"err", err,
		)
		return model.ExportRequest{}, err
	}

	slog.Info("create export request completed",
		"exportRequestId", completed.ID,
		"documentId", completed.DocumentID,
		"format", completed.Format,
		"status", completed.Status,
	)

	return completed, nil
}

func (s *DocumentLifecycleService) GetExportRequest(ctx context.Context, input GetExportRequestInput) (model.ExportRequest, error) {
	_ = input.ActorUserID
	return s.documents.GetExportRequest(ctx, input.DocumentID, input.ExportRequestID)
}

func (s *DocumentLifecycleService) DownloadExportArtifact(ctx context.Context, input DownloadExportArtifactInput) (model.ExportArtifact, error) {
	_ = input.ActorUserID
	return s.documents.GetExportArtifact(ctx, input.DocumentID, input.ExportRequestID)
}

// In-memory repositories keep service runnable before database wiring is complete.
type inMemoryDocumentRepository struct {
	items           map[string]model.Document
	exportRequests  map[string]model.ExportRequest
	exportArtifacts map[string]model.ExportArtifact
}

func newInMemoryDocumentRepository() *inMemoryDocumentRepository {
	return &inMemoryDocumentRepository{
		items:           map[string]model.Document{},
		exportRequests:  map[string]model.ExportRequest{},
		exportArtifacts: map[string]model.ExportArtifact{},
	}
}

func (r *inMemoryDocumentRepository) CreateDraft(_ context.Context, document model.Document) (model.Document, error) {
	document.ID = time.Now().UTC().Format("20060102150405.000000000")
	r.items[document.ID] = document
	return document, nil
}

func (r *inMemoryDocumentRepository) GetByID(_ context.Context, id string) (model.Document, error) {
	document, ok := r.items[id]
	if !ok {
		return model.Document{}, model.ErrDocumentNotFound
	}
	return document, nil
}

func (r *inMemoryDocumentRepository) UpdateDraft(_ context.Context, input outbound.UpdateDraftInput) (model.Document, error) {
	document, ok := r.items[input.DocumentID]
	if !ok {
		return model.Document{}, model.ErrDocumentNotFound
	}
	if document.Version != input.ExpectedVersion {
		return model.Document{}, model.NewVersionConflictError(input.ExpectedVersion, document.Version)
	}
	if !document.Status.IsEditable() {
		return model.Document{}, model.ErrDocumentNotEditable
	}

	document.Title = input.Title
	if input.ContentDocument != nil {
		document.ContentDocument = input.ContentDocument
	}
	document.Version++
	document.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	r.items[input.DocumentID] = document

	return document, nil
}

type inMemoryDocumentVersionRepository struct{}

func newInMemoryDocumentVersionRepository() *inMemoryDocumentVersionRepository {
	return &inMemoryDocumentVersionRepository{}
}

func (r *inMemoryDocumentVersionRepository) AppendVersion(_ context.Context, _ model.Document, _ string, _ string) error {
	return nil
}

func (r *inMemoryDocumentRepository) SearchDocuments(_ context.Context, input outbound.SearchDocumentsInput) ([]model.Document, int64, error) {
	query := strings.TrimSpace(strings.ToLower(input.Query))
	filtered := make([]model.Document, 0, len(r.items))

	for _, item := range r.items {
		if query != "" {
			if !strings.Contains(strings.ToLower(item.Title), query) && !strings.Contains(strings.ToLower(item.Category), query) {
				continue
			}
		}
		if input.Status != "" && item.Status != input.Status {
			continue
		}
		if input.Category != "" && item.Category != input.Category {
			continue
		}
		filtered = append(filtered, item)
	}

	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].UpdatedAt > filtered[j].UpdatedAt
	})

	total := int64(len(filtered))
	start := input.Offset
	if start < 0 {
		start = 0
	}
	limit := input.Limit
	if limit <= 0 {
		limit = 20
	}
	end := start + limit
	if start > len(filtered) {
		return []model.Document{}, total, nil
	}
	if end > len(filtered) {
		end = len(filtered)
	}

	return filtered[start:end], total, nil
}

func (r *inMemoryDocumentRepository) GetEditorControlProfileByContext(_ context.Context, contextType string, contextKey string) (model.EditorControlProfile, error) {
	return model.EditorControlProfile{
		ID:               contextType + ":" + contextKey,
		ContextType:      contextType,
		ContextKey:       contextKey,
		EnabledControls:  []string{"bold", "italic", "heading", "list", "table", "link", "image"},
		DisabledControls: []string{},
		IsActive:         true,
		UpdatedByUserID:  "system",
		UpdatedAt:        time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (r *inMemoryDocumentRepository) UpdateEditorControlProfile(_ context.Context, input outbound.UpdateEditorControlProfileInput) (model.EditorControlProfile, error) {
	contextType := input.FallbackType
	contextKey := input.FallbackContextID
	if contextType == "" {
		contextType = "CATEGORY"
	}
	if contextKey == "" {
		contextKey = "GENERAL"
	}

	return model.EditorControlProfile{
		ID:               input.ProfileID,
		ContextType:      contextType,
		ContextKey:       contextKey,
		EnabledControls:  input.EnabledControls,
		DisabledControls: input.DisabledControls,
		IsActive:         input.IsActive,
		UpdatedByUserID:  input.UpdatedByUserID,
		UpdatedAt:        time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func (r *inMemoryDocumentRepository) CreateExportRequest(_ context.Context, input outbound.CreateExportRequestInput) (model.ExportRequest, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	request := model.ExportRequest{
		ID:              time.Now().UTC().Format("20060102150405.000000000"),
		DocumentID:      input.DocumentID,
		RequestedByUser: input.RequestedByUser,
		Format:          input.Format,
		SourceVersion:   input.SourceVersion,
		Status:          model.ExportRequestStatusQueued,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	r.exportRequests[request.ID] = request
	return request, nil
}

func (r *inMemoryDocumentRepository) CompleteExportRequestSuccess(_ context.Context, input outbound.CompleteExportRequestSuccessInput) (model.ExportRequest, error) {
	request, ok := r.exportRequests[input.ExportRequestID]
	if !ok {
		return model.ExportRequest{}, model.ErrDocumentNotFound
	}

	now := time.Now().UTC().Format(time.RFC3339)
	artifact := model.ExportArtifact{
		ID:         "artifact-" + input.ExportRequestID,
		FileName:   input.FileName,
		MIMEType:   input.MIMEType,
		SizeBytes:  input.SizeBytes,
		DataBase64: input.DataBase64,
		CreatedAt:  now,
	}

	request.Status = model.ExportRequestStatusSucceeded
	request.UpdatedAt = now
	request.Artifact = &artifact
	r.exportRequests[input.ExportRequestID] = request
	r.exportArtifacts[input.ExportRequestID] = artifact

	return request, nil
}

func (r *inMemoryDocumentRepository) GetExportRequest(_ context.Context, documentID string, exportRequestID string) (model.ExportRequest, error) {
	request, ok := r.exportRequests[exportRequestID]
	if !ok || request.DocumentID != documentID {
		return model.ExportRequest{}, model.ErrDocumentNotFound
	}
	return request, nil
}

func (r *inMemoryDocumentRepository) GetExportArtifact(_ context.Context, documentID string, exportRequestID string) (model.ExportArtifact, error) {
	request, ok := r.exportRequests[exportRequestID]
	if !ok || request.DocumentID != documentID {
		return model.ExportArtifact{}, model.ErrDocumentNotFound
	}

	artifact, ok := r.exportArtifacts[exportRequestID]
	if !ok {
		return model.ExportArtifact{}, model.ErrDocumentNotFound
	}

	return artifact, nil
}

func buildExportArtifact(document model.Document, format model.ExportFormat) (model.ExportArtifact, error) {
	lines, images := buildExportContent(document)

	safeTitle := sanitizeFileName(document.Title)
	if safeTitle == "" {
		safeTitle = "document"
	}

	switch format {
	case model.ExportFormatDOCX:
		data, err := generateDOCXExport(lines, images)
		if err != nil {
			return model.ExportArtifact{}, err
		}
		return model.ExportArtifact{
			FileName:   safeTitle + ".docx",
			MIMEType:   "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			SizeBytes:  int64(len(data)),
			DataBase64: base64.StdEncoding.EncodeToString(data),
		}, nil
	case model.ExportFormatPDF:
		data, err := generatePDFExport(lines, images)
		if err != nil {
			return model.ExportArtifact{}, err
		}
		return model.ExportArtifact{
			FileName:   safeTitle + ".pdf",
			MIMEType:   "application/pdf",
			SizeBytes:  int64(len(data)),
			DataBase64: base64.StdEncoding.EncodeToString(data),
		}, nil
	default:
		return model.ExportArtifact{}, fmt.Errorf("unsupported export format: %s", format)
	}
}

func sanitizeFileName(value string) string {
	trimmed := strings.TrimSpace(value)
	replacer := strings.NewReplacer("\\", "_", "/", "_", ":", "_", "*", "_", "?", "_", "\"", "_", "<", "_", ">", "_", "|", "_")
	return strings.ReplaceAll(replacer.Replace(trimmed), " ", "-")
}

func artifactChecksum(dataBase64 string) string {
	sum := sha256.Sum256([]byte(dataBase64))
	return fmt.Sprintf("%x", sum)
}
