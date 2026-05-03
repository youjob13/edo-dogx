package outbound

import (
	"context"

	"edo/services/document-service/internal/domain/model"
)

type DocumentRepository interface {
	CreateDraft(ctx context.Context, document model.Document) (model.Document, error)
	GetByID(ctx context.Context, id string) (model.Document, error)
	UpdateDraft(ctx context.Context, input UpdateDraftInput) (model.Document, error)
	SearchDocuments(ctx context.Context, input SearchDocumentsInput) ([]model.Document, int64, error)
	GetEditorControlProfileByContext(ctx context.Context, contextType string, contextKey string) (model.EditorControlProfile, error)
	UpdateEditorControlProfile(ctx context.Context, input UpdateEditorControlProfileInput) (model.EditorControlProfile, error)
	CreateExportRequest(ctx context.Context, input CreateExportRequestInput) (model.ExportRequest, error)
	CompleteExportRequestSuccess(ctx context.Context, input CompleteExportRequestSuccessInput) (model.ExportRequest, error)
	GetExportRequest(ctx context.Context, documentID string, exportRequestID string) (model.ExportRequest, error)
	GetExportArtifact(ctx context.Context, documentID string, exportRequestID string) (model.ExportArtifact, error)
}

type SearchDocumentsInput struct {
	Query    string
	Status   model.DocumentStatus
	Category string
	Limit    int
	Offset   int
}

type UpdateDraftInput struct {
	DocumentID      string
	ExpectedVersion int64
	Title           string
	ContentDocument map[string]any
	Status          model.DocumentStatus
	ActorUserID     string
}

type UpdateEditorControlProfileInput struct {
	ProfileID         string
	EnabledControls   []string
	DisabledControls  []string
	IsActive          bool
	UpdatedByUserID   string
	FallbackType      string
	FallbackContextID string
}

type CreateExportRequestInput struct {
	DocumentID      string
	RequestedByUser string
	Format          model.ExportFormat
	SourceVersion   int64
}

type CompleteExportRequestSuccessInput struct {
	ExportRequestID string
	DocumentID      string
	Format          model.ExportFormat
	FileName        string
	MIMEType        string
	SizeBytes       int64
	Checksum        string
	DataBase64      string
}

type DocumentVersionRepository interface {
	AppendVersion(ctx context.Context, document model.Document, actorUserID string, changeSummary string) error
}
