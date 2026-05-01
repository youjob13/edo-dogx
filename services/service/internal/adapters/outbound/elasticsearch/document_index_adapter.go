package elasticsearch

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	es8 "github.com/elastic/go-elasticsearch/v8"
)

type IndexedDocument struct {
	DocumentID        string
	CurrentVersionID  string
	Title             string
	Category          string
	Status            string
	OwnerUserID       string
	SearchableContent string
	Tags              []string
	UpdatedAt         string
	IndexVersion      int
}

type QueryFilter struct {
	Query    string
	Category string
	Status   string
	Limit    int
	Offset   int
}

type QueryResult struct {
	Items []IndexedDocument
	Total int
}

type DocumentIndexAdapter struct {
	client *es8.Client
	mu     sync.RWMutex
	store  map[string]IndexedDocument
}

func NewDocumentIndexAdapter(client *es8.Client) *DocumentIndexAdapter {
	return &DocumentIndexAdapter{
		client: client,
		store:  map[string]IndexedDocument{},
	}
}

func (a *DocumentIndexAdapter) Upsert(_ context.Context, document IndexedDocument) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	_ = a.client

	if document.UpdatedAt == "" {
		document.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	a.store[document.DocumentID] = document
	return nil
}

func (a *DocumentIndexAdapter) Query(_ context.Context, filter QueryFilter) (QueryResult, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	items := make([]IndexedDocument, 0)
	q := strings.ToLower(strings.TrimSpace(filter.Query))
	category := strings.ToUpper(strings.TrimSpace(filter.Category))
	status := strings.ToUpper(strings.TrimSpace(filter.Status))

	for _, doc := range a.store {
		if q != "" {
			inTitle := strings.Contains(strings.ToLower(doc.Title), q)
			inContent := strings.Contains(strings.ToLower(doc.SearchableContent), q)
			if !inTitle && !inContent {
				continue
			}
		}
		if category != "" && strings.ToUpper(doc.Category) != category {
			continue
		}
		if status != "" && strings.ToUpper(doc.Status) != status {
			continue
		}
		items = append(items, doc)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].UpdatedAt > items[j].UpdatedAt
	})

	total := len(items)
	start := filter.Offset
	if start < 0 {
		start = 0
	}
	if start > total {
		start = total
	}
	end := total
	if filter.Limit > 0 && start+filter.Limit < end {
		end = start + filter.Limit
	}

	return QueryResult{Items: items[start:end], Total: total}, nil
}
