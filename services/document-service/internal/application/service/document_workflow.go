package service

import (
	"context"
	"strings"

	"edo/services/document-service/internal/domain/model"
	"edo/services/document-service/internal/ports/outbound"
)

type DocumentWorkflowService struct {
	workflows outbound.DocumentWorkflowRepository
}

func NewDocumentWorkflowService(workflows outbound.DocumentWorkflowRepository) *DocumentWorkflowService {
	return &DocumentWorkflowService{workflows: workflows}
}

type SubmitWorkflowInput struct {
	ActorUserID     string
	DocumentID      string
	ApproverUserID  string
	ExpectedVersion int64
}

type DecideWorkflowInput struct {
	ActorUserID     string
	DocumentID      string
	ExpectedVersion int64
	Comment         string
}

type ArchiveDocumentInput struct {
	ActorUserID     string
	DocumentID      string
	ExpectedVersion int64
}

func (s *DocumentWorkflowService) SubmitWorkflow(ctx context.Context, input SubmitWorkflowInput) (model.WorkflowInstance, error) {
	if input.ExpectedVersion <= 0 {
		return model.WorkflowInstance{}, model.ErrWorkflowVersionRequired
	}
	result, err := s.workflows.Transition(ctx, outbound.WorkflowTransitionInput{
		OrganizationID:  "org-main",
		ActorUserID:     input.ActorUserID,
		DocumentID:      input.DocumentID,
		ApproverUserID:  input.ApproverUserID,
		ExpectedVersion: input.ExpectedVersion,
		AllowedFrom:     []model.DocumentStatus{model.DocumentStatusDraft, model.DocumentStatusChangesRequested},
		TargetStatus:    model.DocumentStatusInReview,
		EventType:       "SUBMITTED",
		AllowCreate:     true,
	})
	if err != nil {
		return model.WorkflowInstance{}, err
	}
	return result.Workflow, nil
}

func (s *DocumentWorkflowService) ApproveWorkflow(ctx context.Context, input DecideWorkflowInput) (model.WorkflowInstance, error) {
	if input.ExpectedVersion <= 0 {
		return model.WorkflowInstance{}, model.ErrWorkflowVersionRequired
	}

	result, err := s.workflows.Transition(ctx, outbound.WorkflowTransitionInput{
		OrganizationID:  "org-main",
		ActorUserID:     input.ActorUserID,
		DocumentID:      input.DocumentID,
		ExpectedVersion: input.ExpectedVersion,
		AllowedFrom:     []model.DocumentStatus{model.DocumentStatusInReview},
		TargetStatus:    model.DocumentStatusApproved,
		EventType:       "APPROVED",
	})
	if err != nil {
		return model.WorkflowInstance{}, err
	}
	return result.Workflow, nil
}

func (s *DocumentWorkflowService) RequestWorkflowChanges(ctx context.Context, input DecideWorkflowInput) (model.WorkflowInstance, error) {
	if input.ExpectedVersion <= 0 {
		return model.WorkflowInstance{}, model.ErrWorkflowVersionRequired
	}
	if strings.TrimSpace(input.Comment) == "" {
		return model.WorkflowInstance{}, model.ErrWorkflowCommentRequired
	}

	result, err := s.workflows.Transition(ctx, outbound.WorkflowTransitionInput{
		OrganizationID:  "org-main",
		ActorUserID:     input.ActorUserID,
		DocumentID:      input.DocumentID,
		ExpectedVersion: input.ExpectedVersion,
		AllowedFrom:     []model.DocumentStatus{model.DocumentStatusInReview},
		TargetStatus:    model.DocumentStatusChangesRequested,
		EventType:       "CHANGES_REQUESTED",
		Comment:         input.Comment,
	})
	if err != nil {
		return model.WorkflowInstance{}, err
	}
	return result.Workflow, nil
}

func (s *DocumentWorkflowService) ArchiveDocument(ctx context.Context, input ArchiveDocumentInput) (model.Document, error) {
	if input.ExpectedVersion <= 0 {
		return model.Document{}, model.ErrWorkflowVersionRequired
	}

	result, err := s.workflows.Transition(ctx, outbound.WorkflowTransitionInput{
		OrganizationID:  "org-main",
		ActorUserID:     input.ActorUserID,
		DocumentID:      input.DocumentID,
		ExpectedVersion: input.ExpectedVersion,
		AllowedFrom:     []model.DocumentStatus{model.DocumentStatusApproved},
		TargetStatus:    model.DocumentStatusArchived,
		EventType:       "ARCHIVED",
	})
	if err != nil {
		return model.Document{}, err
	}
	return result.Document, nil
}

func (s *DocumentWorkflowService) GetWorkflow(ctx context.Context, actorUserID string, documentID string) (model.WorkflowInstance, error) {
	return s.workflows.GetByDocumentID(ctx, documentID, actorUserID)
}

func (s *DocumentWorkflowService) ListWorkflowEvents(ctx context.Context, actorUserID string, documentID string, limit int, offset int) ([]model.WorkflowEvent, int64, error) {
	return s.workflows.ListEvents(ctx, documentID, actorUserID, limit, offset)
}
