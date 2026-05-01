package service

import (
	"context"
	"fmt"
	"strings"

	"edo/services/service/internal/domain/model"
)

type CategoryRoutingService struct{}

type CategoryRouteResult struct {
	Category            string
	WorkflowCode        string
	InitialAssigneeRole string
	RetentionClass      string
}

func NewCategoryRoutingService() *CategoryRoutingService {
	return &CategoryRoutingService{}
}

func (s *CategoryRoutingService) ResolveRoute(
	_ context.Context,
	category string,
) (CategoryRouteResult, error) {
	policy, err := model.NewCategoryPolicy(category)
	if err != nil {
		return CategoryRouteResult{}, err
	}
	if err := policy.Validate(); err != nil {
		return CategoryRouteResult{}, err
	}

	initialRole := "edms.approver"
	if policy.RequiresScopedReviewer {
		switch strings.ToUpper(string(policy.Category)) {
		case "HR":
			initialRole = "edms.hr"
		case "FINANCE":
			initialRole = "edms.finance"
		default:
			initialRole = "edms.approver"
		}
	}

	result := CategoryRouteResult{
		Category:            string(policy.Category),
		WorkflowCode:        policy.DefaultWorkflowCode,
		InitialAssigneeRole: initialRole,
		RetentionClass:      policy.RetentionClass,
	}

	if result.WorkflowCode == "" {
		return CategoryRouteResult{}, fmt.Errorf("workflow code was not resolved")
	}

	return result, nil
}
