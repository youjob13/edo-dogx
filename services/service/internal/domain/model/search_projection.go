package model

import (
	"errors"
	"strings"
	"time"
)

type SearchDocumentProjection struct {
	DocumentID        string
	CurrentVersionID  string
	Title             string
	Category          string
	Status            string
	OwnerUserID       string
	SearchableContent string
	Tags              []string
	UpdatedAt         time.Time
	IndexVersion      int
}

func NewSearchDocumentProjection(
	documentID string,
	currentVersionID string,
	title string,
	category string,
	status string,
	ownerUserID string,
	searchableContent string,
	tags []string,
	updatedAt time.Time,
	indexVersion int,
) (SearchDocumentProjection, error) {
	if strings.TrimSpace(documentID) == "" {
		return SearchDocumentProjection{}, errors.New("document id is required")
	}
	if strings.TrimSpace(currentVersionID) == "" {
		return SearchDocumentProjection{}, errors.New("current version id is required")
	}
	if strings.TrimSpace(title) == "" {
		return SearchDocumentProjection{}, errors.New("title is required")
	}
	if strings.TrimSpace(category) == "" {
		return SearchDocumentProjection{}, errors.New("category is required")
	}
	if strings.TrimSpace(status) == "" {
		return SearchDocumentProjection{}, errors.New("status is required")
	}
	if strings.TrimSpace(ownerUserID) == "" {
		return SearchDocumentProjection{}, errors.New("owner user id is required")
	}
	if indexVersion <= 0 {
		return SearchDocumentProjection{}, errors.New("index version must be positive")
	}

	normalizedTags := make([]string, 0, len(tags))
	for _, tag := range tags {
		trimmed := strings.TrimSpace(tag)
		if trimmed == "" {
			continue
		}
		normalizedTags = append(normalizedTags, trimmed)
	}

	return SearchDocumentProjection{
		DocumentID:        strings.TrimSpace(documentID),
		CurrentVersionID:  strings.TrimSpace(currentVersionID),
		Title:             strings.TrimSpace(title),
		Category:          strings.ToUpper(strings.TrimSpace(category)),
		Status:            strings.ToUpper(strings.TrimSpace(status)),
		OwnerUserID:       strings.TrimSpace(ownerUserID),
		SearchableContent: strings.TrimSpace(searchableContent),
		Tags:              normalizedTags,
		UpdatedAt:         updatedAt,
		IndexVersion:      indexVersion,
	}, nil
}
