package model

import (
	"errors"
	"strings"
	"time"
)

type Role struct {
	ID          string
	Code        string
	Name        string
	Description string
}

type PermissionAssignment struct {
	ID            string
	UserID        string
	RoleID        string
	RoleCode      string
	CategoryScope []string
	ExpiresAt     *time.Time
}

func NewRole(id string, code string, name string, description string) (Role, error) {
	if strings.TrimSpace(id) == "" {
		return Role{}, errors.New("role id is required")
	}
	if strings.TrimSpace(code) == "" {
		return Role{}, errors.New("role code is required")
	}
	if strings.TrimSpace(name) == "" {
		return Role{}, errors.New("role name is required")
	}

	return Role{
		ID:          strings.TrimSpace(id),
		Code:        strings.TrimSpace(code),
		Name:        strings.TrimSpace(name),
		Description: strings.TrimSpace(description),
	}, nil
}

func NewPermissionAssignment(
	id string,
	userID string,
	roleID string,
	roleCode string,
	categoryScope []string,
	expiresAt *time.Time,
) (PermissionAssignment, error) {
	if strings.TrimSpace(id) == "" {
		return PermissionAssignment{}, errors.New("assignment id is required")
	}
	if strings.TrimSpace(userID) == "" {
		return PermissionAssignment{}, errors.New("user id is required")
	}
	if strings.TrimSpace(roleID) == "" {
		return PermissionAssignment{}, errors.New("role id is required")
	}
	if strings.TrimSpace(roleCode) == "" {
		return PermissionAssignment{}, errors.New("role code is required")
	}

	normalizedScope := make([]string, 0, len(categoryScope))
	for _, item := range categoryScope {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		normalizedScope = append(normalizedScope, trimmed)
	}

	return PermissionAssignment{
		ID:            strings.TrimSpace(id),
		UserID:        strings.TrimSpace(userID),
		RoleID:        strings.TrimSpace(roleID),
		RoleCode:      strings.TrimSpace(roleCode),
		CategoryScope: normalizedScope,
		ExpiresAt:     expiresAt,
	}, nil
}
