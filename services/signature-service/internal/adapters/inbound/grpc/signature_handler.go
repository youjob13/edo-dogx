package grpcadapter

import "context"

type SignatureHandler struct{}

func NewSignatureHandler() *SignatureHandler {
	return &SignatureHandler{}
}

type SignatureCompatibility struct {
	SchemaVersion string
	ProviderHints map[string]string
}

type RecordSignatureCallbackRequest struct {
	ActorUserID        string
	SignatureRequestID string
	Status             string
	ProviderRef        string
	Compat             SignatureCompatibility
}

func (h *SignatureHandler) RecordSignatureCallback(ctx context.Context, req RecordSignatureCallbackRequest) (map[string]any, error) {
	_ = ctx
	return map[string]any{
		"signatureRequestId": req.SignatureRequestID,
		"status":             req.Status,
		"providerRef":        req.ProviderRef,
		"compat":             req.Compat,
	}, nil
}
