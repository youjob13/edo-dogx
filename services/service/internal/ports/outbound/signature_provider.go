package outbound

import "context"

type SignatureSignerContract struct {
	UserID string
	DueAt  string
}

type SignatureCallbackContract struct {
	SignatureRequestID string
	Status             string
	ProviderRef        string
	EvidenceURI        string
	OccurredAt         string
}

type SignatureProviderPort interface {
	StartSignature(ctx context.Context, actorUserID string, documentID string, signers []SignatureSignerContract) (SignatureRequestRecord, error)
	HandleCallback(ctx context.Context, actorUserID string, callback SignatureCallbackContract) (SignatureRequestRecord, error)
}
