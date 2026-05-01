package model

import (
	"errors"
	"strings"
	"time"
)

type DocumentStatus string

const (
	DocumentStatusDraft            DocumentStatus = "DRAFT"
	DocumentStatusInReview         DocumentStatus = "IN_REVIEW"
	DocumentStatusChangesRequested DocumentStatus = "CHANGES_REQUESTED"
	DocumentStatusApproved         DocumentStatus = "APPROVED"
	DocumentStatusArchived         DocumentStatus = "ARCHIVED"
)

type Document struct {
	ID          string
	Title       string
	Category    string
	OwnerUserID string
	Status      DocumentStatus
	Version     int64
	UpdatedAt   time.Time
}

type DocumentVersion struct {
	DocumentID      string
	Version         int64
	ChangeSummary   string
	ChangedByUserID string
	CreatedAt       time.Time
}

func NewDraftDocument(id string, title string, category string, ownerUserID string, now time.Time) (Document, error) {
	if strings.TrimSpace(id) == "" {
		return Document{}, errors.New("document id is required")
	}
	if strings.TrimSpace(title) == "" {
		return Document{}, errors.New("title is required")
	}
	if strings.TrimSpace(category) == "" {
		return Document{}, errors.New("category is required")
	}
	if strings.TrimSpace(ownerUserID) == "" {
		return Document{}, errors.New("owner user id is required")
	}

	return Document{
		ID:          id,
		Title:       strings.TrimSpace(title),
		Category:    strings.TrimSpace(category),
		OwnerUserID: strings.TrimSpace(ownerUserID),
		Status:      DocumentStatusDraft,
		Version:     1,
		UpdatedAt:   now,
	}, nil
}

func (d Document) WithStatus(status DocumentStatus, now time.Time) Document {
	d.Status = status
	d.Version++
	d.UpdatedAt = now
	return d
}

func (d Document) WithTitle(title string, now time.Time) (Document, error) {
	if strings.TrimSpace(title) == "" {
		return Document{}, errors.New("title is required")
	}
	d.Title = strings.TrimSpace(title)
	d.Version++
	d.UpdatedAt = now
	return d, nil
}
