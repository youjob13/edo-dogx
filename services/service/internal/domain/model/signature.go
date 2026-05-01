package model

import (
	"errors"
	"strings"
	"time"
)

type SignatureRequestStatus string

type SignatureOutcome string

const (
	SignatureRequestStatusPending   SignatureRequestStatus = "PENDING"
	SignatureRequestStatusPartial   SignatureRequestStatus = "PARTIAL"
	SignatureRequestStatusCompleted SignatureRequestStatus = "COMPLETED"
	SignatureRequestStatusFailed    SignatureRequestStatus = "FAILED"
	SignatureRequestStatusExpired   SignatureRequestStatus = "EXPIRED"
)

const (
	SignatureOutcomeSigned   SignatureOutcome = "SIGNED"
	SignatureOutcomeRejected SignatureOutcome = "REJECTED"
	SignatureOutcomeExpired  SignatureOutcome = "EXPIRED"
)

type SignatureRequest struct {
	ID                string
	DocumentID        string
	DocumentVersionID string
	ProviderRef       string
	Status            SignatureRequestStatus
	DueAt             *time.Time
	CreatedByUserID   string
	CreatedAt         time.Time
}

type SignatureRecord struct {
	ID                 string
	SignatureRequestID string
	SignerUserID       string
	SignerDisplayName  string
	SignedAt           *time.Time
	Outcome            SignatureOutcome
	EvidenceURI        string
}

func NewSignatureRequest(
	id string,
	documentID string,
	documentVersionID string,
	createdByUserID string,
	dueAt *time.Time,
	now time.Time,
) (SignatureRequest, error) {
	if strings.TrimSpace(id) == "" {
		return SignatureRequest{}, errors.New("signature request id is required")
	}
	if strings.TrimSpace(documentID) == "" {
		return SignatureRequest{}, errors.New("document id is required")
	}
	if strings.TrimSpace(documentVersionID) == "" {
		return SignatureRequest{}, errors.New("document version id is required")
	}
	if strings.TrimSpace(createdByUserID) == "" {
		return SignatureRequest{}, errors.New("created by user id is required")
	}

	return SignatureRequest{
		ID:                id,
		DocumentID:        documentID,
		DocumentVersionID: documentVersionID,
		Status:            SignatureRequestStatusPending,
		DueAt:             dueAt,
		CreatedByUserID:   createdByUserID,
		CreatedAt:         now,
	}, nil
}

func (r SignatureRequest) WithProviderRef(providerRef string) SignatureRequest {
	r.ProviderRef = strings.TrimSpace(providerRef)
	return r
}

func (r SignatureRequest) WithStatus(status SignatureRequestStatus) SignatureRequest {
	r.Status = status
	return r
}

func NewSignatureRecord(
	id string,
	signatureRequestID string,
	signerUserID string,
	signerDisplayName string,
	outcome SignatureOutcome,
	signedAt *time.Time,
	evidenceURI string,
) (SignatureRecord, error) {
	if strings.TrimSpace(id) == "" {
		return SignatureRecord{}, errors.New("signature record id is required")
	}
	if strings.TrimSpace(signatureRequestID) == "" {
		return SignatureRecord{}, errors.New("signature request id is required")
	}
	if strings.TrimSpace(signerUserID) == "" {
		return SignatureRecord{}, errors.New("signer user id is required")
	}
	if strings.TrimSpace(signerDisplayName) == "" {
		return SignatureRecord{}, errors.New("signer display name is required")
	}
	if outcome == SignatureOutcomeSigned && signedAt == nil {
		return SignatureRecord{}, errors.New("signed at is required for signed outcome")
	}

	return SignatureRecord{
		ID:                 id,
		SignatureRequestID: signatureRequestID,
		SignerUserID:       signerUserID,
		SignerDisplayName:  signerDisplayName,
		SignedAt:           signedAt,
		Outcome:            outcome,
		EvidenceURI:        strings.TrimSpace(evidenceURI),
	}, nil
}
