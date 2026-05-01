package signature

import (
	"context"
	"fmt"
	"time"

	"edo/services/service/internal/ports/outbound"
)

type ProviderAdapter struct {
	requests map[string]outbound.SignatureRequestRecord
}

func NewProviderAdapter() *ProviderAdapter {
	return &ProviderAdapter{requests: map[string]outbound.SignatureRequestRecord{}}
}

func (a *ProviderAdapter) Start(
	_ context.Context,
	_ string,
	documentID string,
	_ []outbound.SignatureSigner,
) (outbound.SignatureRequestRecord, error) {
	id := fmt.Sprintf("sig-%d", time.Now().UnixNano())
	req := outbound.SignatureRequestRecord{
		ID:          id,
		DocumentID:  documentID,
		Status:      "PENDING",
		ProviderRef: "provider-pending",
	}
	a.requests[id] = req
	return req, nil
}

func (a *ProviderAdapter) SyncCallback(
	_ context.Context,
	_ string,
	signatureRequestID string,
	status string,
	providerRef string,
) (outbound.SignatureRequestRecord, error) {
	req, ok := a.requests[signatureRequestID]
	if !ok {
		return outbound.SignatureRequestRecord{}, fmt.Errorf("signature request %s not found", signatureRequestID)
	}

	req.Status = status
	req.ProviderRef = providerRef
	a.requests[signatureRequestID] = req
	return req, nil
}
