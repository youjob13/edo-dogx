package grpcadapter

import (
	"context"

	appservice "edo/services/document-service/internal/application/service"
	"edo/services/document-service/internal/domain/model"

	"google.golang.org/grpc"
)

type DocumentHandler struct {
	lifecycle *appservice.DocumentLifecycleService
}

func NewDocumentHandler() *DocumentHandler {
	return &DocumentHandler{lifecycle: appservice.NewInMemoryDocumentLifecycleService()}
}

// CompatibilityEnvelope keeps additive fields isolated for incremental cutover.
type CompatibilityEnvelope struct {
	SchemaVersion string
	Metadata      map[string]string
}

type CreateDraftRequest struct {
	ActorUserID     string
	Title           string
	Category        string
	ContentDocument map[string]any
	Compat          CompatibilityEnvelope
}

type UpdateDraftRequest struct {
	ActorUserID     string
	DocumentID      string
	Title           string
	ContentDocument map[string]any
	ExpectedVersion int64
}

type GetDocumentRequest struct {
	ActorUserID string
	DocumentID  string
}

type GetEditorControlProfileRequest struct {
	ActorUserID string
	ContextType string
	ContextKey  string
}

type UpdateEditorControlProfileRequest struct {
	ActorUserID      string
	ProfileID        string
	ContextType      string
	ContextKey       string
	EnabledControls  []string
	DisabledControls []string
	IsActive         bool
}

type CreateExportRequest struct {
	ActorUserID   string
	DocumentID    string
	Format        string
	SourceVersion int64
}

type GetExportRequest struct {
	ActorUserID     string
	DocumentID      string
	ExportRequestID string
}

type DownloadExportArtifactRequest struct {
	ActorUserID     string
	DocumentID      string
	ExportRequestID string
}

func (h *DocumentHandler) Register(server *grpc.Server) {
	_ = server
}

func (h *DocumentHandler) CreateDraft(ctx context.Context, req CreateDraftRequest) (map[string]any, error) {
	document, err := h.lifecycle.CreateDraft(ctx, appservice.CreateDraftInput{
		ActorUserID:     req.ActorUserID,
		Title:           req.Title,
		Category:        req.Category,
		ContentDocument: req.ContentDocument,
	})
	if err != nil {
		return nil, err
	}

	return documentToResponse(document), nil
}

func (h *DocumentHandler) UpdateDraft(ctx context.Context, req UpdateDraftRequest) (map[string]any, error) {
	document, err := h.lifecycle.UpdateDraft(ctx, appservice.UpdateDraftInput{
		ActorUserID:     req.ActorUserID,
		DocumentID:      req.DocumentID,
		Title:           req.Title,
		ContentDocument: req.ContentDocument,
		ExpectedVersion: req.ExpectedVersion,
	})
	if err != nil {
		return nil, err
	}

	return documentToResponse(document), nil
}

func (h *DocumentHandler) GetDocument(ctx context.Context, req GetDocumentRequest) (map[string]any, error) {
	document, err := h.lifecycle.GetDocument(ctx, appservice.GetDocumentInput{
		ActorUserID: req.ActorUserID,
		DocumentID:  req.DocumentID,
	})
	if err != nil {
		return nil, err
	}

	return documentToResponse(document), nil
}

func (h *DocumentHandler) GetEditorControlProfile(ctx context.Context, req GetEditorControlProfileRequest) (map[string]any, error) {
	profile, err := h.lifecycle.GetEditorControlProfile(ctx, appservice.GetEditorControlProfileInput{
		ActorUserID: req.ActorUserID,
		ContextType: req.ContextType,
		ContextKey:  req.ContextKey,
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"id":                 profile.ID,
		"context_type":       profile.ContextType,
		"context_key":        profile.ContextKey,
		"enabled_controls":   profile.EnabledControls,
		"disabled_controls":  profile.DisabledControls,
		"is_active":          profile.IsActive,
		"updated_by_user_id": profile.UpdatedByUserID,
		"updated_at":         profile.UpdatedAt,
	}, nil
}

func (h *DocumentHandler) UpdateEditorControlProfile(ctx context.Context, req UpdateEditorControlProfileRequest) (map[string]any, error) {
	profile, err := h.lifecycle.UpdateEditorControlProfile(ctx, appservice.UpdateEditorControlProfileInput{
		ActorUserID:      req.ActorUserID,
		ProfileID:        req.ProfileID,
		ContextType:      req.ContextType,
		ContextKey:       req.ContextKey,
		EnabledControls:  req.EnabledControls,
		DisabledControls: req.DisabledControls,
		IsActive:         req.IsActive,
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"id":                 profile.ID,
		"context_type":       profile.ContextType,
		"context_key":        profile.ContextKey,
		"enabled_controls":   profile.EnabledControls,
		"disabled_controls":  profile.DisabledControls,
		"is_active":          profile.IsActive,
		"updated_by_user_id": profile.UpdatedByUserID,
		"updated_at":         profile.UpdatedAt,
	}, nil
}

func (h *DocumentHandler) CreateExportRequest(ctx context.Context, req CreateExportRequest) (map[string]any, error) {
	exportRequest, err := h.lifecycle.CreateExportRequest(ctx, appservice.CreateExportRequestInput{
		ActorUserID:   req.ActorUserID,
		DocumentID:    req.DocumentID,
		Format:        model.ExportFormat(req.Format),
		SourceVersion: req.SourceVersion,
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"id":             exportRequest.ID,
		"document_id":    exportRequest.DocumentID,
		"format":         exportRequest.Format,
		"source_version": exportRequest.SourceVersion,
		"status":         exportRequest.Status,
		"created_at":     exportRequest.CreatedAt,
		"updated_at":     exportRequest.UpdatedAt,
	}, nil
}

func (h *DocumentHandler) GetExportRequest(ctx context.Context, req GetExportRequest) (map[string]any, error) {
	exportRequest, err := h.lifecycle.GetExportRequest(ctx, appservice.GetExportRequestInput{
		ActorUserID:     req.ActorUserID,
		DocumentID:      req.DocumentID,
		ExportRequestID: req.ExportRequestID,
	})
	if err != nil {
		return nil, err
	}

	response := map[string]any{
		"id":             exportRequest.ID,
		"document_id":    exportRequest.DocumentID,
		"format":         exportRequest.Format,
		"source_version": exportRequest.SourceVersion,
		"status":         exportRequest.Status,
		"error_code":     exportRequest.ErrorCode,
		"error_message":  exportRequest.ErrorMessage,
		"created_at":     exportRequest.CreatedAt,
		"updated_at":     exportRequest.UpdatedAt,
	}

	if exportRequest.Artifact != nil {
		response["artifact"] = map[string]any{
			"id":         exportRequest.Artifact.ID,
			"file_name":  exportRequest.Artifact.FileName,
			"mime_type":  exportRequest.Artifact.MIMEType,
			"size_bytes": exportRequest.Artifact.SizeBytes,
			"created_at": exportRequest.Artifact.CreatedAt,
		}
	}

	return response, nil
}

func (h *DocumentHandler) DownloadExportArtifact(ctx context.Context, req DownloadExportArtifactRequest) (map[string]any, error) {
	artifact, err := h.lifecycle.DownloadExportArtifact(ctx, appservice.DownloadExportArtifactInput{
		ActorUserID:     req.ActorUserID,
		DocumentID:      req.DocumentID,
		ExportRequestID: req.ExportRequestID,
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"artifact_id":  artifact.ID,
		"file_name":    artifact.FileName,
		"mime_type":    artifact.MIMEType,
		"size_bytes":   artifact.SizeBytes,
		"data_base64":  artifact.DataBase64,
		"generated_at": artifact.CreatedAt,
	}, nil
}

func documentToResponse(document model.Document) map[string]any {
	return map[string]any{
		"id":                    document.ID,
		"title":                 document.Title,
		"category":              document.Category,
		"status":                document.Status,
		"content_document_json": document.ContentDocument,
		"owner_user_id":         document.OwnerUser,
		"version":               document.Version,
		"updated_at":            document.UpdatedAt,
	}
}
