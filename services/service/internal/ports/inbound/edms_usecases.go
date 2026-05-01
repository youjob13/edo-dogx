package inbound

import "context"

type CreateDraftInput struct {
	ActorUserID string
	Title       string
	Category    string
}

type UpdateDraftInput struct {
	ActorUserID     string
	DocumentID      string
	Title           string
	ExpectedVersion int64
}

type SearchDocumentsInput struct {
	ActorUserID string
	Query       string
	Status      string
	Category    string
	Limit       int32
	Offset      int32
}

type SignatureSignerInput struct {
	UserID string
	DueAt  string
}

type StartSignatureInput struct {
	ActorUserID string
	DocumentID  string
	Signers     []SignatureSignerInput
}

type LifecycleUseCases interface {
	CreateDraft(ctx context.Context, in CreateDraftInput) (any, error)
	UpdateDraft(ctx context.Context, in UpdateDraftInput) (any, error)
	GetDocument(ctx context.Context, actorUserID string, documentID string) (any, error)
	SearchDocuments(ctx context.Context, in SearchDocumentsInput) (any, error)
	ArchiveDocument(ctx context.Context, actorUserID string, documentID string, expectedVersion int64) (any, error)
}

type SignatureUseCases interface {
	StartSignature(ctx context.Context, in StartSignatureInput) (any, error)
	RecordSignatureCallback(ctx context.Context, actorUserID string, signatureRequestID string, status string, providerRef string) (any, error)
	GetSignatureStatus(ctx context.Context, actorUserID string, documentID string) (any, error)
}

type AuthorizationUseCases interface {
	CheckPermission(ctx context.Context, actorUserID string, action string, category string) (bool, error)
	AssignRole(ctx context.Context, actorUserID string, userID string, roleCode string) (bool, error)
	RevokeRole(ctx context.Context, actorUserID string, userID string, roleCode string) (bool, error)
}

type AuditUseCases interface {
	AppendAuditEvent(ctx context.Context, actorUserID string, actionType string, outcome string, targetID string) (string, error)
	GetAuditEvents(ctx context.Context, actorUserID string, documentID string) ([]any, error)
}

type NotificationUseCases interface {
	EmitNotification(ctx context.Context, actorUserID string, eventType string, recipientUserID string, documentID string) (string, error)
	RetryFailedNotifications(ctx context.Context, actorUserID string, batchSize int32) (int32, error)
}
