package service

import (
	"context"
	"fmt"

	"edo/services/service/internal/ports/inbound"
	"edo/services/service/internal/ports/outbound"
)

type DocumentLifecycleService struct {
	documents outbound.DocumentRepository
	workflows outbound.WorkflowRepository
	policy    *WorkflowPolicy
}

func NewDocumentLifecycleService(
	documents outbound.DocumentRepository,
	workflows outbound.WorkflowRepository,
	policy *WorkflowPolicy,
) *DocumentLifecycleService {
	if policy == nil {
		policy = NewWorkflowPolicy()
	}
	return &DocumentLifecycleService{
		documents: documents,
		workflows: workflows,
		policy:    policy,
	}
}

func (s *DocumentLifecycleService) CreateDraft(ctx context.Context, in inbound.CreateDraftInput) (any, error) {
	return s.documents.CreateDraft(ctx, in.ActorUserID, in.Title, in.Category)
}

func (s *DocumentLifecycleService) UpdateDraft(ctx context.Context, in inbound.UpdateDraftInput) (any, error) {
	return s.documents.UpdateDraft(ctx, in.ActorUserID, in.DocumentID, in.Title, in.ExpectedVersion)
}

func (s *DocumentLifecycleService) GetDocument(ctx context.Context, actorUserID string, documentID string) (any, error) {
	return s.documents.GetByID(ctx, actorUserID, documentID)
}

func (s *DocumentLifecycleService) SearchDocuments(ctx context.Context, in inbound.SearchDocumentsInput) (any, error) {
	return s.documents.Search(ctx, in.ActorUserID, outbound.SearchDocumentsFilter{
		Query:    in.Query,
		Status:   in.Status,
		Category: in.Category,
		Limit:    in.Limit,
		Offset:   in.Offset,
	})
}

func (s *DocumentLifecycleService) ArchiveDocument(ctx context.Context, actorUserID string, documentID string, expectedVersion int64) (any, error) {
	doc, err := s.documents.GetByID(ctx, actorUserID, documentID)
	if err != nil {
		return nil, err
	}
	if err := s.policy.ValidateTransition(doc.Status, "ARCHIVED"); err != nil {
		return nil, err
	}
	return s.documents.Archive(ctx, actorUserID, documentID, expectedVersion)
}

func (s *DocumentLifecycleService) SubmitForReview(ctx context.Context, actorUserID string, documentID string) error {
	doc, err := s.documents.GetByID(ctx, actorUserID, documentID)
	if err != nil {
		return err
	}
	if err := s.policy.ValidateTransition(doc.Status, "IN_REVIEW"); err != nil {
		return err
	}
	return s.workflows.Submit(ctx, actorUserID, documentID)
}

func (s *DocumentLifecycleService) ApproveCurrentStep(ctx context.Context, actorUserID string, documentID string, expectedVersion int64) error {
	doc, err := s.documents.GetByID(ctx, actorUserID, documentID)
	if err != nil {
		return err
	}
	if err := s.policy.ValidateTransition(doc.Status, "APPROVED"); err != nil {
		return fmt.Errorf("cannot approve document: %w", err)
	}
	return s.workflows.Approve(ctx, actorUserID, documentID, expectedVersion)
}
