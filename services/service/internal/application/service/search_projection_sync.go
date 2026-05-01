package service

import (
	"context"
	"fmt"
	"strings"

	"edo/services/service/internal/adapters/outbound/elasticsearch"
	"edo/services/service/internal/ports/outbound"
)

type SearchProjectionSyncService struct {
	documents outbound.DocumentRepository
	indexer   *elasticsearch.DocumentIndexAdapter
}

func NewSearchProjectionSyncService(
	documents outbound.DocumentRepository,
	indexer *elasticsearch.DocumentIndexAdapter,
) *SearchProjectionSyncService {
	return &SearchProjectionSyncService{documents: documents, indexer: indexer}
}

func (s *SearchProjectionSyncService) SyncDocument(ctx context.Context, actorUserID string, documentID string) error {
	doc, err := s.documents.GetByID(ctx, actorUserID, documentID)
	if err != nil {
		return err
	}

	projection := elasticsearch.IndexedDocument{
		DocumentID:        doc.ID,
		CurrentVersionID:  fmt.Sprintf("%s-v%d", doc.ID, doc.Version),
		Title:             doc.Title,
		Category:          strings.ToUpper(doc.Category),
		Status:            strings.ToUpper(doc.Status),
		OwnerUserID:       actorUserID,
		SearchableContent: doc.Title,
		Tags:              []string{strings.ToLower(doc.Category), strings.ToLower(doc.Status)},
		IndexVersion:      1,
	}

	return s.indexer.Upsert(ctx, projection)
}

func (s *SearchProjectionSyncService) Search(
	ctx context.Context,
	query string,
	category string,
	status string,
	limit int,
	offset int,
) (elasticsearch.QueryResult, error) {
	return s.indexer.Query(ctx, elasticsearch.QueryFilter{
		Query:    query,
		Category: category,
		Status:   status,
		Limit:    limit,
		Offset:   offset,
	})
}
