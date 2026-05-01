package service

import (
	"context"
	"strings"

	"edo/services/service/internal/ports/outbound"
)

type AuthorizationPolicyService struct {
	repository outbound.AuthorizationRepository
}

func NewAuthorizationPolicyService(repository outbound.AuthorizationRepository) *AuthorizationPolicyService {
	return &AuthorizationPolicyService{repository: repository}
}

func (s *AuthorizationPolicyService) CheckPermission(
	ctx context.Context,
	actorUserID string,
	action string,
	category string,
) (bool, error) {
	normalizedAction := strings.TrimSpace(action)
	normalizedCategory := strings.TrimSpace(category)
	return s.repository.CheckPermission(ctx, actorUserID, normalizedAction, normalizedCategory)
}

func (s *AuthorizationPolicyService) AssignRole(
	ctx context.Context,
	actorUserID string,
	userID string,
	roleCode string,
) (bool, error) {
	return s.repository.AssignRole(ctx, actorUserID, userID, roleCode)
}

func (s *AuthorizationPolicyService) RevokeRole(
	ctx context.Context,
	actorUserID string,
	userID string,
	roleCode string,
) (bool, error) {
	return s.repository.RevokeRole(ctx, actorUserID, userID, roleCode)
}
