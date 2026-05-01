package model

type DocumentStatus string

const (
	DocumentStatusDraft    DocumentStatus = "DRAFT"
	DocumentStatusInReview DocumentStatus = "IN_REVIEW"
	DocumentStatusApproved DocumentStatus = "APPROVED"
	DocumentStatusArchived DocumentStatus = "ARCHIVED"
)

type Document struct {
	ID        string
	Title     string
	Category  string
	Status    DocumentStatus
	OwnerUser string
	Version   int64
	UpdatedAt string
}
