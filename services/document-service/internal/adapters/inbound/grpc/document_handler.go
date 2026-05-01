package grpcadapter

import "context"

type DocumentHandler struct{}

func NewDocumentHandler() *DocumentHandler {
	return &DocumentHandler{}
}

// CompatibilityEnvelope keeps additive fields isolated for incremental cutover.
type CompatibilityEnvelope struct {
	SchemaVersion string
	Metadata      map[string]string
}

type CreateDraftRequest struct {
	ActorUserID string
	Title       string
	Category    string
	Compat      CompatibilityEnvelope
}

func (h *DocumentHandler) CreateDraft(ctx context.Context, req CreateDraftRequest) (map[string]any, error) {
	_ = ctx
	return map[string]any{
		"actorUserId": req.ActorUserID,
		"title":       req.Title,
		"category":    req.Category,
		"compat":      req.Compat,
	}, nil
}
