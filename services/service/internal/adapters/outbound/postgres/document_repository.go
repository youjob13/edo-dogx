package postgres

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"edo/services/service/internal/ports/outbound"
)

type DocumentRepository struct {
	mu        sync.RWMutex
	documents map[string]outbound.DocumentRecord
}

func NewDocumentRepository() *DocumentRepository {
	return &DocumentRepository{
		documents: map[string]outbound.DocumentRecord{},
	}
}

func (r *DocumentRepository) CreateDraft(_ context.Context, actorUserID string, title string, category string) (outbound.DocumentRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	_ = actorUserID

	id := fmt.Sprintf("doc-%d", time.Now().UnixNano())
	doc := outbound.DocumentRecord{
		ID:       id,
		Title:    strings.TrimSpace(title),
		Category: strings.TrimSpace(category),
		Status:   "DRAFT",
		Version:  1,
	}
	r.documents[id] = doc
	return doc, nil
}

func (r *DocumentRepository) UpdateDraft(_ context.Context, _ string, documentID string, title string, expectedVersion int64) (outbound.DocumentRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	doc, ok := r.documents[documentID]
	if !ok {
		return outbound.DocumentRecord{}, fmt.Errorf("document %s not found", documentID)
	}
	if doc.Version != expectedVersion {
		return outbound.DocumentRecord{}, fmt.Errorf("document version mismatch")
	}
	doc.Title = strings.TrimSpace(title)
	doc.Version++
	r.documents[documentID] = doc
	return doc, nil
}

func (r *DocumentRepository) GetByID(_ context.Context, _ string, documentID string) (outbound.DocumentRecord, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	doc, ok := r.documents[documentID]
	if !ok {
		return outbound.DocumentRecord{}, fmt.Errorf("document %s not found", documentID)
	}
	return doc, nil
}

func (r *DocumentRepository) Search(_ context.Context, _ string, filter outbound.SearchDocumentsFilter) (outbound.SearchDocumentsResult, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items := make([]outbound.DocumentRecord, 0)
	q := strings.ToLower(strings.TrimSpace(filter.Query))
	for _, doc := range r.documents {
		if q != "" && !strings.Contains(strings.ToLower(doc.Title), q) {
			continue
		}
		if filter.Status != "" && doc.Status != filter.Status {
			continue
		}
		if filter.Category != "" && doc.Category != filter.Category {
			continue
		}
		items = append(items, doc)
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Version == items[j].Version {
			return items[i].ID > items[j].ID
		}
		return items[i].Version > items[j].Version
	})

	total := int32(len(items))
	start := int(filter.Offset)
	if start > len(items) {
		start = len(items)
	}
	end := len(items)
	if filter.Limit > 0 {
		candidate := start + int(filter.Limit)
		if candidate < end {
			end = candidate
		}
	}

	return outbound.SearchDocumentsResult{
		Items: items[start:end],
		Total: total,
	}, nil
}

func (r *DocumentRepository) Archive(_ context.Context, _ string, documentID string, expectedVersion int64) (outbound.DocumentRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	doc, ok := r.documents[documentID]
	if !ok {
		return outbound.DocumentRecord{}, fmt.Errorf("document %s not found", documentID)
	}
	if doc.Version != expectedVersion {
		return outbound.DocumentRecord{}, fmt.Errorf("document version mismatch")
	}
	doc.Status = "ARCHIVED"
	doc.Version++
	r.documents[documentID] = doc
	return doc, nil
}

func (r *DocumentRepository) Submit(_ context.Context, _ string, documentID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	doc, ok := r.documents[documentID]
	if !ok {
		return fmt.Errorf("document %s not found", documentID)
	}
	doc.Status = "IN_REVIEW"
	doc.Version++
	r.documents[documentID] = doc
	return nil
}

func (r *DocumentRepository) Approve(_ context.Context, _ string, documentID string, expectedVersion int64) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	doc, ok := r.documents[documentID]
	if !ok {
		return fmt.Errorf("document %s not found", documentID)
	}
	if doc.Version != expectedVersion {
		return fmt.Errorf("document version mismatch")
	}
	doc.Status = "APPROVED"
	doc.Version++
	r.documents[documentID] = doc
	return nil
}
