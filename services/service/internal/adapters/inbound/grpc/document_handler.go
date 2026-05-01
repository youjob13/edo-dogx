package grpcadapter

import (
	"context"

	"edo/services/service/internal/ports/inbound"
)

type DocumentWorkflowUseCases interface {
	inbound.LifecycleUseCases
	SubmitForReview(ctx context.Context, actorUserID string, documentID string) error
	ApproveCurrentStep(ctx context.Context, actorUserID string, documentID string, expectedVersion int64) error
}

type DocumentHandler struct {
	lifecycle DocumentWorkflowUseCases
}

func NewDocumentHandler(lifecycle DocumentWorkflowUseCases) *DocumentHandler {
	return &DocumentHandler{lifecycle: lifecycle}
}

type CreateDraftRequest struct {
	ActorUserID string
	Title       string
	Category    string
}

type UpdateDraftRequest struct {
	ActorUserID     string
	DocumentID      string
	Title           string
	ExpectedVersion int64
}

type SearchDocumentsRequest struct {
	ActorUserID string
	Query       string
	Status      string
	Category    string
	Limit       int32
	Offset      int32
}

type ArchiveDocumentRequest struct {
	ActorUserID     string
	DocumentID      string
	ExpectedVersion int64
}

type SubmitDocumentRequest struct {
	ActorUserID string
	DocumentID  string
}

type ApproveDocumentRequest struct {
	ActorUserID     string
	DocumentID      string
	ExpectedVersion int64
}

func (h *DocumentHandler) CreateDraft(ctx context.Context, req CreateDraftRequest) (any, error) {
	return h.lifecycle.CreateDraft(ctx, inbound.CreateDraftInput{
		ActorUserID: req.ActorUserID,
		Title:       req.Title,
		Category:    req.Category,
	})
}

func (h *DocumentHandler) UpdateDraft(ctx context.Context, req UpdateDraftRequest) (any, error) {
	return h.lifecycle.UpdateDraft(ctx, inbound.UpdateDraftInput{
		ActorUserID:     req.ActorUserID,
		DocumentID:      req.DocumentID,
		Title:           req.Title,
		ExpectedVersion: req.ExpectedVersion,
	})
}

func (h *DocumentHandler) SearchDocuments(ctx context.Context, req SearchDocumentsRequest) (any, error) {
	return h.lifecycle.SearchDocuments(ctx, inbound.SearchDocumentsInput{
		ActorUserID: req.ActorUserID,
		Query:       req.Query,
		Status:      req.Status,
		Category:    req.Category,
		Limit:       req.Limit,
		Offset:      req.Offset,
	})
}

func (h *DocumentHandler) SubmitDocument(ctx context.Context, req SubmitDocumentRequest) error {
	return h.lifecycle.SubmitForReview(ctx, req.ActorUserID, req.DocumentID)
}

func (h *DocumentHandler) ApproveDocument(ctx context.Context, req ApproveDocumentRequest) error {
	return h.lifecycle.ApproveCurrentStep(ctx, req.ActorUserID, req.DocumentID, req.ExpectedVersion)
}

func (h *DocumentHandler) ArchiveDocument(ctx context.Context, req ArchiveDocumentRequest) (any, error) {
	return h.lifecycle.ArchiveDocument(ctx, req.ActorUserID, req.DocumentID, req.ExpectedVersion)
}
