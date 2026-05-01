package service

import (
	"fmt"
)

type WorkflowPolicy struct {
	allowed map[string]map[string]struct{}
}

func NewWorkflowPolicy() *WorkflowPolicy {
	return &WorkflowPolicy{
		allowed: map[string]map[string]struct{}{
			"DRAFT":             {"IN_REVIEW": {}},
			"IN_REVIEW":         {"CHANGES_REQUESTED": {}, "APPROVED": {}},
			"CHANGES_REQUESTED": {"DRAFT": {}},
			"APPROVED":          {"ARCHIVED": {}},
		},
	}
}

func (p *WorkflowPolicy) ValidateTransition(from string, to string) error {
	next, ok := p.allowed[from]
	if !ok {
		return fmt.Errorf("no transitions configured for state %s", from)
	}
	if _, allowed := next[to]; !allowed {
		return fmt.Errorf("transition %s -> %s is not allowed", from, to)
	}
	return nil
}
