package elasticsearch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	app "edo/services/search-notification-service/internal/application/service"
)

type ProjectionStore struct {
	baseURL    string
	httpClient *http.Client
}

func NewProjectionStore(baseURL string) *ProjectionStore {
	trimmed := strings.TrimRight(baseURL, "/")
	if trimmed == "" {
		trimmed = "http://elasticsearch:9200"
	}
	return &ProjectionStore{baseURL: trimmed, httpClient: &http.Client{}}
}

func (s *ProjectionStore) EnsureIndexes(ctx context.Context) error {
	if err := s.ensureDocumentIndex(ctx); err != nil {
		return err
	}
	return s.ensureTaskIndex(ctx)
}

func (s *ProjectionStore) ensureDocumentIndex(ctx context.Context) error {
	payload := map[string]any{
		"settings": map[string]any{"number_of_shards": 1, "number_of_replicas": 0},
		"mappings": map[string]any{
			"properties": map[string]any{
				"entity_type":   map[string]any{"type": "keyword"},
				"id":            map[string]any{"type": "keyword"},
				"title":         map[string]any{"type": "text", "fields": map[string]any{"keyword": map[string]any{"type": "keyword"}}},
				"category":      map[string]any{"type": "keyword"},
				"status":        map[string]any{"type": "keyword"},
				"updated_at":    map[string]any{"type": "date"},
				"owner_user_id": map[string]any{"type": "keyword"},
			},
		},
		"aliases": map[string]any{"edo_global_search": map[string]any{}},
	}
	return s.putIfMissing(ctx, "edo_documents_v1", payload)
}

func (s *ProjectionStore) ensureTaskIndex(ctx context.Context) error {
	payload := map[string]any{
		"settings": map[string]any{"number_of_shards": 1, "number_of_replicas": 0},
		"mappings": map[string]any{
			"properties": map[string]any{
				"entity_type":      map[string]any{"type": "keyword"},
				"id":               map[string]any{"type": "keyword"},
				"board_id":         map[string]any{"type": "keyword"},
				"title":            map[string]any{"type": "text", "fields": map[string]any{"keyword": map[string]any{"type": "keyword"}}},
				"status":           map[string]any{"type": "keyword"},
				"updated_at":       map[string]any{"type": "date"},
				"creator_user_id":  map[string]any{"type": "keyword"},
				"assignee_user_id": map[string]any{"type": "keyword"},
				"approver_user_id": map[string]any{"type": "keyword"},
				"allowed_user_ids": map[string]any{"type": "keyword"},
			},
		},
		"aliases": map[string]any{"edo_global_search": map[string]any{}},
	}
	return s.putIfMissing(ctx, "edo_tasks_v1", payload)
}

func (s *ProjectionStore) putIfMissing(ctx context.Context, index string, payload map[string]any) error {
	getReq, _ := http.NewRequestWithContext(ctx, http.MethodHead, fmt.Sprintf("%s/%s", s.baseURL, index), nil)
	resp, err := s.httpClient.Do(getReq)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return nil
	}

	body, _ := json.Marshal(payload)
	putReq, _ := http.NewRequestWithContext(ctx, http.MethodPut, fmt.Sprintf("%s/%s", s.baseURL, index), bytes.NewReader(body))
	putReq.Header.Set("Content-Type", "application/json")
	putResp, err := s.httpClient.Do(putReq)
	if err != nil {
		return err
	}
	defer putResp.Body.Close()
	if putResp.StatusCode >= 300 {
		content, _ := io.ReadAll(putResp.Body)
		return fmt.Errorf("ensure index %s failed: %s", index, string(content))
	}
	return nil
}

func (s *ProjectionStore) BulkUpsertDocuments(ctx context.Context, docs []app.IndexedDocument) error {
	if len(docs) == 0 {
		return nil
	}
	var b strings.Builder
	for _, doc := range docs {
		meta := fmt.Sprintf(`{"index":{"_index":"edo_documents_v1","_id":"%s"}}`, doc.ID)
		source, _ := json.Marshal(map[string]any{
			"entity_type":   "DOCUMENT",
			"id":            doc.ID,
			"title":         doc.Title,
			"category":      doc.Category,
			"status":        strings.ToUpper(doc.Status),
			"updated_at":    doc.UpdatedAt,
			"owner_user_id": doc.OwnerUserID,
		})
		b.WriteString(meta + "\n")
		b.WriteString(string(source) + "\n")
	}
	return s.bulk(ctx, b.String())
}

func (s *ProjectionStore) BulkUpsertTasks(ctx context.Context, tasks []app.IndexedTask) error {
	if len(tasks) == 0 {
		return nil
	}
	var b strings.Builder
	for _, task := range tasks {
		meta := fmt.Sprintf(`{"index":{"_index":"edo_tasks_v1","_id":"%s"}}`, task.ID)
		source, _ := json.Marshal(map[string]any{
			"entity_type":      "TASK",
			"id":               task.ID,
			"board_id":         task.BoardID,
			"title":            task.Title,
			"status":           strings.ToLower(task.Status),
			"updated_at":       task.UpdatedAt,
			"creator_user_id":  task.CreatorUserID,
			"assignee_user_id": task.AssigneeUserID,
			"approver_user_id": task.ApproverUserID,
			"allowed_user_ids": task.AllowedUserIDs,
		})
		b.WriteString(meta + "\n")
		b.WriteString(string(source) + "\n")
	}
	return s.bulk(ctx, b.String())
}

func (s *ProjectionStore) DeleteEntity(ctx context.Context, entityType app.SearchEntityType, entityID string) error {
	index := "edo_documents_v1"
	if entityType == app.SearchEntityTask {
		index = "edo_tasks_v1"
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, fmt.Sprintf("%s/%s/_doc/%s", s.baseURL, index, entityID), nil)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode >= 300 {
		content, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete entity failed: %s", string(content))
	}
	return nil
}

func (s *ProjectionStore) SearchGlobal(ctx context.Context, actorUserID string, query string, limit int, offset int, entities []app.SearchEntityType) ([]app.SearchHit, int, error) {
	terms := make([]string, 0, len(entities))
	for _, entity := range entities {
		terms = append(terms, string(entity))
	}
	body := map[string]any{
		"from": offset,
		"size": limit,
		"sort": []any{map[string]any{"updated_at": map[string]any{"order": "desc"}}},
		"query": map[string]any{
			"bool": map[string]any{
				"must": []any{
					map[string]any{
						"simple_query_string": map[string]any{
							"query":            strings.TrimSpace(query) + "*",
							"fields":           []string{"title^3", "category"},
							"default_operator": "and",
						},
					},
				},
				"filter": []any{
					map[string]any{"terms": map[string]any{"entity_type": terms}},
					map[string]any{
						"bool": map[string]any{
							"should": []any{
								map[string]any{"bool": map[string]any{"must": []any{map[string]any{"term": map[string]any{"entity_type": "DOCUMENT"}}, map[string]any{"term": map[string]any{"owner_user_id": actorUserID}}}}},
								map[string]any{"bool": map[string]any{"must": []any{map[string]any{"term": map[string]any{"entity_type": "TASK"}}, map[string]any{"term": map[string]any{"allowed_user_ids": actorUserID}}}}},
							},
							"minimum_should_match": 1,
						},
					},
				},
			},
		},
	}
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/edo_global_search/_search", s.baseURL), bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		content, _ := io.ReadAll(resp.Body)
		return nil, 0, fmt.Errorf("search failed: %s", string(content))
	}

	var data struct {
		Hits struct {
			Total struct {
				Value int `json:"value"`
			} `json:"total"`
			Hits []struct {
				Source map[string]any `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, 0, err
	}

	results := make([]app.SearchHit, 0, len(data.Hits.Hits))
	for _, hit := range data.Hits.Hits {
		src := hit.Source
		entityType := strings.ToUpper(asString(src["entity_type"]))
		result := app.SearchHit{
			EntityType: app.SearchEntityType(entityType),
			ID:         asString(src["id"]),
			Title:      asString(src["title"]),
			Status:     asString(src["status"]),
			UpdatedAt:  asString(src["updated_at"]),
		}
		if entityType == "DOCUMENT" {
			result.Subtitle = "Документ"
			result.DocumentID = result.ID
			result.Category = asString(src["category"])
			result.OwnerUserID = asString(src["owner_user_id"])
			result.Route = "/dashboard/documents/" + result.ID + "/edit"
		} else {
			result.Subtitle = "Задача"
			result.TaskID = result.ID
			result.BoardID = asString(src["board_id"])
			result.CreatorUserID = asString(src["creator_user_id"])
			result.AssigneeUserID = asString(src["assignee_user_id"])
			result.ApproverUserID = asString(src["approver_user_id"])
			result.Route = "/dashboard/tasks/" + result.BoardID + "/task/" + result.ID
		}
		results = append(results, result)
	}
	return results, data.Hits.Total.Value, nil
}

func (s *ProjectionStore) bulk(ctx context.Context, payload string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/_bulk", s.baseURL), strings.NewReader(payload))
	req.Header.Set("Content-Type", "application/x-ndjson")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		content, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bulk operation failed: %s", string(content))
	}
	return nil
}

func asString(value any) string {
	switch v := value.(type) {
	case string:
		return v
	default:
		return ""
	}
}

var _ app.SearchProjectionStore = (*ProjectionStore)(nil)
