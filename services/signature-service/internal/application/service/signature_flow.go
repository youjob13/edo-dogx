package service

import "context"

type SignatureFlowService struct{}

func NewSignatureFlowService() *SignatureFlowService {
	return &SignatureFlowService{}
}

type StartSignatureInput struct {
	ActorUserID string
	DocumentID  string
	SignerIDs   []string
}

func (s *SignatureFlowService) StartSignature(ctx context.Context, input StartSignatureInput) error {
	_ = ctx
	_ = input
	return nil
}
