package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

type SearchEntityType string

const (
	SearchEntityDocument SearchEntityType = "DOCUMENT"
	SearchEntityTask     SearchEntityType = "TASK"
)

type IndexedDocument struct {
	ID          string
	Title       string
	Category    string
	Status      string
	UpdatedAt   time.Time
	OwnerUserID string
}

type IndexedTask struct {
	ID             string
	BoardID        string
	Title          string
	Status         string
	UpdatedAt      time.Time
	CreatorUserID  string
	AssigneeUserID string
	ApproverUserID string
	AllowedUserIDs []string
}

type SearchHit struct {
	EntityType     SearchEntityType
	ID             string
	Title          string
	Subtitle       string
	Status         string
	UpdatedAt      string
	Route          string
	DocumentID     string
	TaskID         string
	BoardID        string
	Category       string
	OwnerUserID    string
	CreatorUserID  string
	AssigneeUserID string
	ApproverUserID string
}

type SearchProjectionStore interface {
	EnsureIndexes(ctx context.Context) error
	BulkUpsertDocuments(ctx context.Context, docs []IndexedDocument) error
	BulkUpsertTasks(ctx context.Context, tasks []IndexedTask) error
	DeleteEntity(ctx context.Context, entityType SearchEntityType, entityID string) error
	SearchGlobal(ctx context.Context, actorUserID string, query string, limit int, offset int, entities []SearchEntityType) ([]SearchHit, int, error)
}

type SearchSourceRepository interface {
	ListDocuments(ctx context.Context) ([]IndexedDocument, error)
	ListTasks(ctx context.Context) ([]IndexedTask, error)
	GetDocumentByID(ctx context.Context, id string) (*IndexedDocument, error)
	GetTaskByID(ctx context.Context, id string) (*IndexedTask, error)
}

type SearchNotificationService struct {
	source SearchSourceRepository
	store  SearchProjectionStore
}

func NewSearchNotificationService(source SearchSourceRepository, store SearchProjectionStore) *SearchNotificationService {
	return &SearchNotificationService{source: source, store: store}
}

func (s *SearchNotificationService) BootstrapIndexes(ctx context.Context) error {
	if err := s.store.EnsureIndexes(ctx); err != nil {
		return err
	}

	docs, err := s.source.ListDocuments(ctx)
	if err != nil {
		return err
	}
	if len(docs) > 0 {
		if err := s.store.BulkUpsertDocuments(ctx, docs); err != nil {
			return err
		}
	}

	tasks, err := s.source.ListTasks(ctx)
	if err != nil {
		return err
	}
	if len(tasks) > 0 {
		if err := s.store.BulkUpsertTasks(ctx, tasks); err != nil {
			return err
		}
	}

	return nil
}

func (s *SearchNotificationService) SyncProjection(ctx context.Context, entityType SearchEntityType, entityID string, deleted bool) error {
	entityType = normalizeEntityType(entityType)
	if entityID == "" {
		return errors.New("entity id is required")
	}

	if deleted {
		return s.store.DeleteEntity(ctx, entityType, entityID)
	}

	switch entityType {
	case SearchEntityDocument:
		doc, err := s.source.GetDocumentByID(ctx, entityID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return s.store.DeleteEntity(ctx, entityType, entityID)
			}
			return err
		}
		return s.store.BulkUpsertDocuments(ctx, []IndexedDocument{*doc})
	case SearchEntityTask:
		task, err := s.source.GetTaskByID(ctx, entityID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return s.store.DeleteEntity(ctx, entityType, entityID)
			}
			return err
		}
		return s.store.BulkUpsertTasks(ctx, []IndexedTask{*task})
	default:
		return fmt.Errorf("unsupported entity type: %s", entityType)
	}
}

func (s *SearchNotificationService) SearchGlobal(ctx context.Context, actorUserID, query string, limit, offset int, entities []SearchEntityType) ([]SearchHit, int, error) {
	if strings.TrimSpace(actorUserID) == "" {
		return nil, 0, errors.New("actor user id is required")
	}
	if limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	if len(entities) == 0 {
		entities = []SearchEntityType{SearchEntityDocument, SearchEntityTask}
	}

	hits, total, err := s.store.SearchGlobal(ctx, actorUserID, query, limit, offset, entities)
	if err != nil {
		return nil, 0, err
	}

	sort.SliceStable(hits, func(i, j int) bool {
		return hits[i].UpdatedAt > hits[j].UpdatedAt
	})

	return hits, total, nil
}

func normalizeEntityType(entityType SearchEntityType) SearchEntityType {
	switch strings.ToUpper(strings.TrimSpace(string(entityType))) {
	case "TASK":
		return SearchEntityTask
	default:
		return SearchEntityDocument
	}
}
