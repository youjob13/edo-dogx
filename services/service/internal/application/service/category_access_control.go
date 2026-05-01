package service

import (
	"context"
	"strings"
)

type CategoryAccessControlService struct {
	authorization *AuthorizationPolicyService
}

func NewCategoryAccessControlService(
	authorization *AuthorizationPolicyService,
) *CategoryAccessControlService {
	return &CategoryAccessControlService{authorization: authorization}
}

func (s *CategoryAccessControlService) CanReadCategory(
	ctx context.Context,
	actorUserID string,
	category string,
) (bool, error) {
	return s.authorization.CheckPermission(ctx, actorUserID, "documents.read", strings.ToUpper(category))
}

func (s *CategoryAccessControlService) CanAssignCategoryWorkflow(
	ctx context.Context,
	actorUserID string,
	category string,
) (bool, error) {
	return s.authorization.CheckPermission(ctx, actorUserID, "documents.approve", strings.ToUpper(category))
}
