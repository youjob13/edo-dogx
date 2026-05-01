package service

import "context"

type DocumentLifecycleService struct{}

func NewDocumentLifecycleService() *DocumentLifecycleService {
	return &DocumentLifecycleService{}
}

type CreateDraftInput struct {
	ActorUserID string
	Title       string
	Category    string
}

func (s *DocumentLifecycleService) CreateDraft(ctx context.Context, input CreateDraftInput) error {
	_ = ctx
	_ = input
	return nil
}
