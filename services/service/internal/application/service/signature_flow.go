package service

import (
	"context"
	"fmt"
	"strings"

	"edo/services/service/internal/ports/inbound"
	"edo/services/service/internal/ports/outbound"
)

type SignatureFlowService struct {
	documents  outbound.DocumentRepository
	provider   outbound.SignatureProvider
	byDocument map[string]outbound.SignatureRequestRecord
}

func NewSignatureFlowService(
	documents outbound.DocumentRepository,
	provider outbound.SignatureProvider,
) *SignatureFlowService {
	return &SignatureFlowService{
		documents:  documents,
		provider:   provider,
		byDocument: map[string]outbound.SignatureRequestRecord{},
	}
}

func (s *SignatureFlowService) StartSignature(ctx context.Context, in inbound.StartSignatureInput) (any, error) {
	doc, err := s.documents.GetByID(ctx, in.ActorUserID, in.DocumentID)
	if err != nil {
		return nil, err
	}

	if doc.Status != "APPROVED" {
		return nil, fmt.Errorf("document %s is not signature-eligible", doc.ID)
	}

	signers := make([]outbound.SignatureSigner, 0, len(in.Signers))
	for _, signer := range in.Signers {
		if strings.TrimSpace(signer.UserID) == "" {
			return nil, fmt.Errorf("signer user id is required")
		}
		signers = append(signers, outbound.SignatureSigner{
			UserID: signer.UserID,
			DueAt:  signer.DueAt,
		})
	}

	result, err := s.provider.Start(ctx, in.ActorUserID, in.DocumentID, signers)
	if err != nil {
		return nil, err
	}

	s.byDocument[in.DocumentID] = result
	return result, nil
}

func (s *SignatureFlowService) RecordSignatureCallback(
	ctx context.Context,
	actorUserID string,
	signatureRequestID string,
	status string,
	providerRef string,
) (any, error) {
	result, err := s.provider.SyncCallback(ctx, actorUserID, signatureRequestID, status, providerRef)
	if err != nil {
		return nil, err
	}

	s.byDocument[result.DocumentID] = result
	return result, nil
}

func (s *SignatureFlowService) GetSignatureStatus(ctx context.Context, actorUserID string, documentID string) (any, error) {
	_, err := s.documents.GetByID(ctx, actorUserID, documentID)
	if err != nil {
		return nil, err
	}

	result, ok := s.byDocument[documentID]
	if !ok {
		return nil, fmt.Errorf("no signature request found for document %s", documentID)
	}

	return result, nil
}
