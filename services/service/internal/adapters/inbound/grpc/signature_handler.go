package grpcadapter

import (
	"context"

	"edo/services/service/internal/ports/inbound"
)

type SignatureHandler struct {
	useCases inbound.SignatureUseCases
}

func NewSignatureHandler(useCases inbound.SignatureUseCases) *SignatureHandler {
	return &SignatureHandler{useCases: useCases}
}

type StartSignatureRequest struct {
	ActorUserID string
	DocumentID  string
	Signers     []inbound.SignatureSignerInput
}

type RecordSignatureCallbackRequest struct {
	ActorUserID        string
	SignatureRequestID string
	Status             string
	ProviderRef        string
}

type GetSignatureStatusRequest struct {
	ActorUserID string
	DocumentID  string
}

func (h *SignatureHandler) StartSignature(ctx context.Context, req StartSignatureRequest) (any, error) {
	return h.useCases.StartSignature(ctx, inbound.StartSignatureInput{
		ActorUserID: req.ActorUserID,
		DocumentID:  req.DocumentID,
		Signers:     req.Signers,
	})
}

func (h *SignatureHandler) RecordSignatureCallback(ctx context.Context, req RecordSignatureCallbackRequest) (any, error) {
	return h.useCases.RecordSignatureCallback(
		ctx,
		req.ActorUserID,
		req.SignatureRequestID,
		req.Status,
		req.ProviderRef,
	)
}

func (h *SignatureHandler) GetSignatureStatus(ctx context.Context, req GetSignatureStatusRequest) (any, error) {
	return h.useCases.GetSignatureStatus(ctx, req.ActorUserID, req.DocumentID)
}
