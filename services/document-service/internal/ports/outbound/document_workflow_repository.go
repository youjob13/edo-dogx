package outbound

import (
	"context"

	"edo/services/document-service/internal/domain/model"
)

type WorkflowTransitionInput struct {
	OrganizationID  string
	ActorUserID     string
	DocumentID      string
	ApproverUserID  string
	ExpectedVersion int64
	AllowedFrom     []model.DocumentStatus
	TargetStatus    model.DocumentStatus
	EventType       string
	Comment         string
	AllowCreate     bool
}

type WorkflowTransitionResult struct {
	Document model.Document
	Workflow model.WorkflowInstance
}

type DocumentWorkflowRepository interface {
	Transition(ctx context.Context, input WorkflowTransitionInput) (WorkflowTransitionResult, error)
	GetByDocumentID(ctx context.Context, documentID string, actorUserID string) (model.WorkflowInstance, error)
	ListEvents(ctx context.Context, documentID string, actorUserID string, limit int, offset int) ([]model.WorkflowEvent, int64, error)
}
