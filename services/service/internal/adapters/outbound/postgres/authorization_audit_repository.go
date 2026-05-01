package postgres

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"edo/services/service/internal/ports/outbound"
)

type AuthorizationAuditRepository struct {
	mu                sync.RWMutex
	rolesByUser       map[string]map[string]struct{}
	auditByDocumentID map[string][]outbound.AuditEventRecord
	nextAuditID       int64
}

func NewAuthorizationAuditRepository() *AuthorizationAuditRepository {
	return &AuthorizationAuditRepository{
		rolesByUser:       map[string]map[string]struct{}{},
		auditByDocumentID: map[string][]outbound.AuditEventRecord{},
		nextAuditID:       1,
	}
}

func (r *AuthorizationAuditRepository) CheckPermission(
	_ context.Context,
	actorUserID string,
	action string,
	category string,
) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	roles := r.rolesByUser[actorUserID]
	if len(roles) == 0 {
		return false, nil
	}

	if _, ok := roles["edms.admin"]; ok {
		return true, nil
	}

	requiredRole := requiredRoleByAction(action)
	if requiredRole != "" {
		if _, ok := roles[requiredRole]; !ok {
			return false, nil
		}
	}

	normalizedCategory := strings.ToUpper(strings.TrimSpace(category))
	switch normalizedCategory {
	case "HR":
		_, allowed := roles["edms.hr"]
		return allowed, nil
	case "FINANCE":
		_, allowed := roles["edms.finance"]
		return allowed, nil
	default:
		return true, nil
	}
}

func (r *AuthorizationAuditRepository) AssignRole(
	_ context.Context,
	_ string,
	userID string,
	roleCode string,
) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	normalizedUserID := strings.TrimSpace(userID)
	normalizedRole := strings.TrimSpace(roleCode)
	if normalizedUserID == "" || normalizedRole == "" {
		return false, nil
	}

	if _, ok := r.rolesByUser[normalizedUserID]; !ok {
		r.rolesByUser[normalizedUserID] = map[string]struct{}{}
	}
	r.rolesByUser[normalizedUserID][normalizedRole] = struct{}{}
	return true, nil
}

func (r *AuthorizationAuditRepository) RevokeRole(
	_ context.Context,
	_ string,
	userID string,
	roleCode string,
) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	normalizedUserID := strings.TrimSpace(userID)
	normalizedRole := strings.TrimSpace(roleCode)
	roles, ok := r.rolesByUser[normalizedUserID]
	if !ok {
		return false, nil
	}
	if _, exists := roles[normalizedRole]; !exists {
		return false, nil
	}
	delete(roles, normalizedRole)
	return true, nil
}

func (r *AuthorizationAuditRepository) Append(
	_ context.Context,
	event outbound.AuditEventRecord,
) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	targetID := strings.TrimSpace(event.TargetID)
	if targetID == "" {
		return "", fmt.Errorf("audit target id is required")
	}

	id := fmt.Sprintf("audit-%d", r.nextAuditID)
	r.nextAuditID++

	record := event
	record.ID = id
	if strings.TrimSpace(record.OccurredAt) == "" {
		record.OccurredAt = time.Now().UTC().Format(time.RFC3339)
	}

	r.auditByDocumentID[targetID] = append(r.auditByDocumentID[targetID], record)
	return id, nil
}

func (r *AuthorizationAuditRepository) ListByDocument(
	_ context.Context,
	_ string,
	documentID string,
) ([]outbound.AuditEventRecord, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	items := r.auditByDocumentID[documentID]
	result := make([]outbound.AuditEventRecord, 0, len(items))
	for _, item := range items {
		result = append(result, item)
	}
	return result, nil
}

func requiredRoleByAction(action string) string {
	switch strings.TrimSpace(action) {
	case "documents.create", "documents.update", "documents.read", "signatures.start":
		return "edms.user"
	case "documents.approve", "documents.archive", "signatures.callback":
		return "edms.approver"
	default:
		return ""
	}
}
