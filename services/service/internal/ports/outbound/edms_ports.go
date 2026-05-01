package outbound

import "context"

type DocumentRecord struct {
	ID       string
	Title    string
	Category string
	Status   string
	Version  int64
}

type SearchDocumentsFilter struct {
	Query    string
	Status   string
	Category string
	Limit    int32
	Offset   int32
}

type SearchDocumentsResult struct {
	Items []DocumentRecord
	Total int32
}

type SignatureSigner struct {
	UserID string
	DueAt  string
}

type SignatureRequestRecord struct {
	ID          string
	DocumentID  string
	Status      string
	ProviderRef string
}

type AuditEventRecord struct {
	ID          string
	ActorUserID string
	ActionType  string
	Outcome     string
	TargetID    string
	OccurredAt  string
}

type DocumentRepository interface {
	CreateDraft(ctx context.Context, actorUserID string, title string, category string) (DocumentRecord, error)
	UpdateDraft(ctx context.Context, actorUserID string, documentID string, title string, expectedVersion int64) (DocumentRecord, error)
	GetByID(ctx context.Context, actorUserID string, documentID string) (DocumentRecord, error)
	Search(ctx context.Context, actorUserID string, filter SearchDocumentsFilter) (SearchDocumentsResult, error)
	Archive(ctx context.Context, actorUserID string, documentID string, expectedVersion int64) (DocumentRecord, error)
}

type WorkflowRepository interface {
	Submit(ctx context.Context, actorUserID string, documentID string) error
	Approve(ctx context.Context, actorUserID string, documentID string, expectedVersion int64) error
}

type SignatureProvider interface {
	Start(ctx context.Context, actorUserID string, documentID string, signers []SignatureSigner) (SignatureRequestRecord, error)
	SyncCallback(ctx context.Context, actorUserID string, signatureRequestID string, status string, providerRef string) (SignatureRequestRecord, error)
}

type AuthorizationRepository interface {
	CheckPermission(ctx context.Context, actorUserID string, action string, category string) (bool, error)
	AssignRole(ctx context.Context, actorUserID string, userID string, roleCode string) (bool, error)
	RevokeRole(ctx context.Context, actorUserID string, userID string, roleCode string) (bool, error)
}

type AuditRepository interface {
	Append(ctx context.Context, event AuditEventRecord) (string, error)
	ListByDocument(ctx context.Context, actorUserID string, documentID string) ([]AuditEventRecord, error)
}

type NotificationPublisher interface {
	Emit(ctx context.Context, actorUserID string, eventType string, recipientUserID string, documentID string) (string, error)
	RetryFailed(ctx context.Context, actorUserID string, batchSize int32) (int32, error)
}
