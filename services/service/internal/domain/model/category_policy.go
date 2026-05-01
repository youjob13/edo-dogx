package model

import (
	"errors"
	"fmt"
	"strings"
)

type DocumentCategory string

const (
	DocumentCategoryHR      DocumentCategory = "HR"
	DocumentCategoryFinance DocumentCategory = "FINANCE"
	DocumentCategoryGeneral DocumentCategory = "GENERAL"
)

type CategoryPolicy struct {
	Category               DocumentCategory
	RequiresScopedReviewer bool
	RetentionClass         string
	DefaultWorkflowCode    string
	AllowedReaderRoles     []string
	AllowedApproverRoles   []string
}

func NewCategoryPolicy(category string) (CategoryPolicy, error) {
	switch DocumentCategory(strings.ToUpper(strings.TrimSpace(category))) {
	case DocumentCategoryHR:
		return CategoryPolicy{
			Category:               DocumentCategoryHR,
			RequiresScopedReviewer: true,
			RetentionClass:         "HR_STANDARD",
			DefaultWorkflowCode:    "hr-approval",
			AllowedReaderRoles:     []string{"edms.hr", "edms.admin"},
			AllowedApproverRoles:   []string{"edms.hr", "edms.approver", "edms.admin"},
		}, nil
	case DocumentCategoryFinance:
		return CategoryPolicy{
			Category:               DocumentCategoryFinance,
			RequiresScopedReviewer: true,
			RetentionClass:         "FINANCE_LONG",
			DefaultWorkflowCode:    "finance-approval",
			AllowedReaderRoles:     []string{"edms.finance", "edms.admin"},
			AllowedApproverRoles:   []string{"edms.finance", "edms.approver", "edms.admin"},
		}, nil
	case DocumentCategoryGeneral:
		return CategoryPolicy{
			Category:               DocumentCategoryGeneral,
			RequiresScopedReviewer: false,
			RetentionClass:         "GENERAL_DEFAULT",
			DefaultWorkflowCode:    "general-approval",
			AllowedReaderRoles:     []string{"edms.user", "edms.admin"},
			AllowedApproverRoles:   []string{"edms.approver", "edms.admin"},
		}, nil
	default:
		return CategoryPolicy{}, fmt.Errorf("unsupported category: %s", category)
	}
}

func (p CategoryPolicy) Validate() error {
	if p.Category == "" {
		return errors.New("category is required")
	}
	if strings.TrimSpace(p.DefaultWorkflowCode) == "" {
		return errors.New("default workflow code is required")
	}
	if len(p.AllowedReaderRoles) == 0 {
		return errors.New("at least one reader role is required")
	}
	if len(p.AllowedApproverRoles) == 0 {
		return errors.New("at least one approver role is required")
	}
	return nil
}
